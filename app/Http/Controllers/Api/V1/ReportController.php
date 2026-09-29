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

    private const TOP = 5;

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
                    'avg_days_to_consume' => $this->averageDaysToConsume($current),
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

    /** @param  Collection<int, HouseholdMovement>  $movements */
    private function averageDaysToConsume(Collection $movements): ?float
    {
        $consumed = $movements->filter(fn (HouseholdMovement $movement): bool => $movement->action === MovementAction::Consumed
            && $movement->batch_id !== null);

        if ($consumed->isEmpty()) {
            return null;
        }

        $createdAt = Batch::query()
            ->whereIn('id', $consumed->pluck('batch_id')->unique()->all())
            ->pluck('created_at', 'id');

        $spans = $consumed
            ->filter(fn (HouseholdMovement $movement): bool => isset($createdAt[$movement->batch_id]))
            ->map(fn (HouseholdMovement $movement): float => max(0, CarbonImmutable::parse($createdAt[$movement->batch_id])
                ->diffInHours(CarbonImmutable::parse($movement->created_at))) / 24);

        return $spans->isEmpty() ? null : round((float) $spans->avg(), 1);
    }

    /**
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return list<array{date: string, consumed: int, discarded: int}>
     */
    private function timeline(Collection $movements, CarbonImmutable $start, CarbonImmutable $today, string $bucket): array
    {
        $keyOf = fn (CarbonImmutable $at): string => $bucket === 'week'
            ? $at->startOfWeek()->toDateString()
            : $at->toDateString();

        $points = [];
        $cursor = $bucket === 'week' ? $start->startOfWeek() : $start;
        while ($cursor <= $today) {
            $points[$cursor->toDateString()] = ['date' => $cursor->toDateString(), 'consumed' => 0, 'discarded' => 0];
            $cursor = $bucket === 'week' ? $cursor->addWeek() : $cursor->addDay();
        }

        foreach ($movements as $movement) {
            $field = match ($movement->action) {
                MovementAction::Consumed => 'consumed',
                MovementAction::Discarded => 'discarded',
                default => null,
            };
            $key = $keyOf($movement->getAttribute('local_at'));
            if ($field !== null && isset($points[$key])) {
                $points[$key][$field] += (int) $movement->quantity;
            }
        }

        return array_values($points);
    }

    /**
     * @param  Collection<int, HouseholdMovement>  $movements
     * @return list<array{product_name: string, units: int}>
     */
    private function topProducts(Collection $movements, MovementAction $action): array
    {
        return $movements
            ->filter(fn (HouseholdMovement $movement): bool => $movement->action === $action && $movement->product_name !== null)
            ->groupBy('product_name')
            ->map(fn (Collection $group, string $name): array => ['product_name' => $name, 'units' => (int) $group->sum('quantity')])
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
