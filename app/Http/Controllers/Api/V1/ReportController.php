<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\MovementAction;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Household;
use App\Models\HouseholdMovement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * Pantry reports for owners and managers, aggregated from household_movements
 * over the last N days (and the N days before, for comparison). Days are
 * bucketed in the viewer's timezone. The current state of the pantry (what is
 * expiring) comes from the batches the app already loads.
 */
final class ReportController extends Controller
{
    use AuthorizesRequests;

    /**
     * Ranking size. The page shows the first five; the detail modal can show
     * more without a second request.
     */
    private const TOP = 20;

    /** How many products to name under each timeline bucket. */
    private const ITEMS = 3;

    public function show(Request $request, Household $household): JsonResponse
    {
        $this->authorize('manageMembers', $household);

        $validated = $request->validate([
            'days' => ['sometimes', 'integer', Rule::in([7, 30, 90])],
            'timezone' => ['sometimes', 'string', Rule::in(timezone_identifiers_list())],
        ]);

        $days = (int) ($validated['days'] ?? 30);
        $timezone = $validated['timezone'] ?? (string) config('app.timezone');

        $today = CarbonImmutable::now($timezone)->startOfDay();
        $start = $today->subDays($days - 1);
        $previousStart = $start->subDays($days);

        // Timestamps are stored on the app clock, so the window bound must be
        // converted to it too; a raw UTC bound would drop the first hours.
        $movements = HouseholdMovement::query()
            ->where('household_id', $household->id)
            ->where('created_at', '>=', $previousStart->setTimezone((string) config('app.timezone')))
            ->get(['action', 'user_id', 'batch_id', 'product_name', 'quantity', 'created_at'])
            ->each(fn (HouseholdMovement $movement) => $movement->setAttribute(
                'local_at',
                CarbonImmutable::parse($movement->created_at)->setTimezone($timezone),
            ));

        $current = $movements->filter(fn (HouseholdMovement $movement): bool => $movement->getAttribute('local_at') >= $start);
        $previous = $movements->filter(fn (HouseholdMovement $movement): bool => $movement->getAttribute('local_at') < $start);

        $bucket = $days === 90 ? 'week' : 'day';

        $spans = $this->consumptionSpans($current);

        return response()->json([
            'data' => [
                'period' => [
                    'days' => $days,
                    'from' => $start->toDateString(),
                    'to' => $today->toDateString(),
                    'timezone' => $timezone,
                    'bucket' => $bucket,
                ],
                'totals' => $this->totals($current) + [
                    'operations' => $current->count(),
                    'avg_days_to_consume' => $spans->isEmpty() ? null : round((float) $spans->avg(), 1),
                    'median_days_to_consume' => $this->median($spans),
                ],
                'previous' => $this->totals($previous),
                'timeline' => $this->timeline($current, $start, $today, $bucket),
                'top_consumed' => $this->topProducts($current, MovementAction::Consumed),
                'top_discarded' => $this->topProducts($current, MovementAction::Discarded),
                'members' => $this->members($household, $current),
            ],
        ]);
    }

    /**
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return array{added_units: int, consumed_units: int, discarded_units: int, use_rate: float|null}
     */
    private function totals(Collection $movements): array
    {
        $units = fn (MovementAction $action): int => (int) $movements
            ->filter(fn (HouseholdMovement $movement): bool => $movement->action === $action)
            ->sum('quantity');

        $consumed = $units(MovementAction::Consumed);
        $discarded = $units(MovementAction::Discarded);

        return [
            'added_units' => $units(MovementAction::Created),
            'consumed_units' => $consumed,
            'discarded_units' => $discarded,
            // Share of what left the pantry that was eaten rather than thrown away.
            'use_rate' => $consumed + $discarded === 0 ? null : round($consumed / ($consumed + $discarded), 4),
        ];
    }

    /**
     * Days between each consumed batch's creation and its consumption, one
     * span per consumed movement.
     *
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return Collection<int, float>
     */
    private function consumptionSpans(Collection $movements): Collection
    {
        $consumed = $movements->filter(fn (HouseholdMovement $movement): bool => $movement->action === MovementAction::Consumed
            && $movement->batch_id !== null);

        if ($consumed->isEmpty()) {
            return collect();
        }

        $createdAt = Batch::query()
            ->whereIn('id', $consumed->pluck('batch_id')->unique()->all())
            ->pluck('created_at', 'id');

        return $consumed
            ->filter(fn (HouseholdMovement $movement): bool => isset($createdAt[$movement->batch_id]))
            ->map(fn (HouseholdMovement $movement): float => max(0, CarbonImmutable::parse($createdAt[$movement->batch_id])
                ->diffInHours(CarbonImmutable::parse($movement->created_at))) / 24)
            ->values();
    }

    /**
     * Median of a numeric collection, rounded to one decimal. The collection
     * is sorted in place; pass a throwaway copy if the order matters.
     *
     * @param  Collection<int, float>  $values
     */
    private function median(Collection $values): ?float
    {
        if ($values->isEmpty()) {
            return null;
        }

        $sorted = $values->sort()->values();
        $middle = intdiv($sorted->count(), 2);

        $median = $sorted->count() % 2 === 1
            ? (float) $sorted->get($middle)
            : ((float) $sorted->get($middle - 1) + (float) $sorted->get($middle)) / 2;

        return round($median, 1);
    }

    /**
     * One point per bucket, zero-filled, with the units in and out plus the
     * products behind the consumed/discarded units.
     *
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return list<array{
     *     date: string,
     *     consumed: int,
     *     discarded: int,
     *     added: int,
     *     use_rate: float|null,
     *     consumed_items: list<array{product_name: string, units: int}>,
     *     discarded_items: list<array{product_name: string, units: int}>
     * }>
     */
    private function timeline(Collection $movements, CarbonImmutable $start, CarbonImmutable $today, string $bucket): array
    {
        $keyOf = fn (CarbonImmutable $at): string => $bucket === 'week'
            ? $at->startOfWeek()->toDateString()
            : $at->toDateString();

        $bucketed = $movements->groupBy(
            fn (HouseholdMovement $movement): string => $keyOf($movement->getAttribute('local_at')),
        );

        $points = [];
        $cursor = $bucket === 'week' ? $start->startOfWeek() : $start;
        while ($cursor <= $today) {
            $key = $cursor->toDateString();
            /** @var Collection<int, HouseholdMovement> $in */
            $in = $bucketed->get($key, collect());

            $consumed = $this->units($in, MovementAction::Consumed);
            $discarded = $this->units($in, MovementAction::Discarded);

            $points[] = [
                'date' => $key,
                'consumed' => $consumed,
                'discarded' => $discarded,
                'added' => $this->units($in, MovementAction::Created),
                'use_rate' => $consumed + $discarded === 0 ? null : round($consumed / ($consumed + $discarded), 4),
                'consumed_items' => $this->productItems($in, MovementAction::Consumed, self::ITEMS),
                'discarded_items' => $this->productItems($in, MovementAction::Discarded, self::ITEMS),
            ];

            $cursor = $bucket === 'week' ? $cursor->addWeek() : $cursor->addDay();
        }

        return $points;
    }

    /** @param  Collection<int, HouseholdMovement>  $movements */
    private function units(Collection $movements, MovementAction $action): int
    {
        return (int) $movements
            ->filter(fn (HouseholdMovement $movement): bool => $movement->action === $action)
            ->sum('quantity');
    }

    /**
     * Movements of one action grouped by the product name snapshot.
     *
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return Collection<string, Collection<int, HouseholdMovement>>
     */
    private function byProduct(Collection $movements, MovementAction $action): Collection
    {
        return $movements
            ->filter(fn (HouseholdMovement $movement): bool => $movement->action === $action && $movement->product_name !== null)
            ->groupBy('product_name');
    }

    /**
     * Top products of an action by units, without the ranking metadata.
     *
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return list<array{product_name: string, units: int}>
     */
    private function productItems(Collection $movements, MovementAction $action, int $limit): array
    {
        return $this->byProduct($movements, $action)
            ->map(fn (Collection $group, string $name): array => ['product_name' => $name, 'units' => (int) $group->sum('quantity')])
            ->sortByDesc('units')
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return list<array{product_name: string, units: int, events: int, last_at: string|null}>
     */
    private function topProducts(Collection $movements, MovementAction $action): array
    {
        return $this->byProduct($movements, $action)
            ->map(function (Collection $group, string $name): array {
                $last = $group->max(fn (HouseholdMovement $movement) => $movement->getAttribute('local_at'));

                return [
                    'product_name' => $name,
                    'units' => (int) $group->sum('quantity'),
                    'events' => $group->count(),
                    'last_at' => $last instanceof CarbonImmutable ? $last->toDateString() : null,
                ];
            })
            ->sortByDesc('units')
            ->take(self::TOP)
            ->values()
            ->all();
    }

    /**
     * Who did what in the period (operations, not units). Current members
     * always appear; former members only if they operated.
     *
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return list<array<string, mixed>>
     */
    private function members(Household $household, Collection $movements): array
    {
        $memberIds = $household->users()->pluck('users.id')->all();
        $byUser = $movements->whereNotNull('user_id')->groupBy('user_id');
        $ids = array_values(array_unique([...$memberIds, ...$byUser->keys()->map(fn ($id): int => (int) $id)->all()]));

        return User::query()
            ->whereIn('id', $ids)
            ->get(['id', 'name'])
            ->map(function (User $user) use ($byUser, $memberIds): array {
                /** @var Collection<int, HouseholdMovement> $own */
                $own = $byUser->get($user->id, collect());
                $count = fn (MovementAction $action): int => $own->filter(fn (HouseholdMovement $movement): bool => $movement->action === $action)->count();

                $added = $count(MovementAction::Created);
                $consumed = $count(MovementAction::Consumed);
                $discarded = $count(MovementAction::Discarded);

                return [
                    'user' => ['id' => $user->id, 'name' => $user->name],
                    'is_member' => in_array($user->id, $memberIds, true),
                    'added' => $added,
                    'consumed' => $consumed,
                    'discarded' => $discarded,
                    'other' => $own->count() - $added - $consumed - $discarded,
                    'total' => $own->count(),
                ];
            })
            ->sortByDesc('total')
            ->values()
            ->all();
    }
}
