<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\HouseholdRole;
use App\Enums\MovementAction;
use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\HouseholdMovement;
use App\Models\User;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class HouseholdController extends Controller
{
    use AuthorizesRequests;

    public function update(Request $request, Household $household): JsonResponse
    {
        $this->authorize('removeMembers', $household);

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
        ]);

        DB::transaction(function () use ($request, $household, $validated): void {
            $before = $household->name;
            $household->update(['name' => $validated['name']]);

            if ($before !== $household->name) {
                HouseholdMovement::forHousehold($household, MovementAction::HouseholdRenamed, $request->user(), null, [
                    'name' => [$before, $household->name],
                ]);
            }
        });

        return response()->json([
            'message' => 'Household updated.',
            'household' => [
                'id' => $household->id,
                'name' => $household->name,
            ],
        ]);
    }

    public function members(Request $request, Household $household): JsonResponse
    {
        $this->authorize('view', $household);

        $members = $household->users()
            ->withPivot('role', 'created_at')
            ->get()
            ->map(function (User $user) use ($household): array {
                $pivot = $user->getAttribute('pivot');

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $pivot->getAttribute('role'),
                    'joined_at' => $pivot->getAttribute('created_at'),
                    'operations_count' => $this->operationsCount($household, $user),
                ];
            })
            ->values()
            ->all();

        return response()->json(['data' => $members]);
    }

    public function actors(Request $request, Household $household): JsonResponse
    {
        $this->authorize('manageMembers', $household);

        $memberIds = $household->users()->pluck('users.id')->all();

        $operatorIds = HouseholdMovement::query()
            ->where('household_id', $household->id)
            ->whereNotNull('user_id')
            ->distinct()
            ->pluck('user_id')
            ->all();

        // Current members always appear; former members only if they operated.
        $actorIds = array_values(array_unique([...$memberIds, ...$operatorIds]));

        $actors = User::query()
            ->whereIn('id', $actorIds)
            ->orderBy('name')
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'is_member' => in_array($user->id, $memberIds, true),
            ])
            ->values()
            ->all();

        return response()->json(['data' => $actors]);
    }

    /**
     * The household history, newest first, one page at a time: pass the
     * returned meta.next_before as ?before= for the next page.
     */
    public function activities(Request $request, Household $household): JsonResponse
    {
        $this->authorize('manageMembers', $household);

        $validated = $request->validate([
            'user_id' => ['sometimes', 'integer'],
            'action' => ['sometimes', 'string', Rule::in([...array_column(MovementAction::cases(), 'value'), 'members'])],
            'search' => ['sometimes', 'string', 'max:255'],
            'before' => ['sometimes', 'integer', 'min:1'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $limit = (int) ($validated['limit'] ?? 50);

        $query = HouseholdMovement::query()
            ->with(['user:id,name', 'subject:id,name'])
            ->where('household_id', $household->id)
            ->orderByDesc('id');

        if (isset($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        if (isset($validated['action'])) {
            $validated['action'] === 'members'
                ? $query->whereIn('action', MovementAction::memberActions())
                : $query->where('action', $validated['action']);
        }

        if (isset($validated['search']) && $validated['search'] !== '') {
            $query->whereLike('product_name', "%{$validated['search']}%", caseSensitive: false);
        }

        if (isset($validated['before'])) {
            $query->where('id', '<', $validated['before']);
        }

        $rows = $query->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $page = $rows->take($limit);

        return response()->json([
            'data' => $page->map(fn (HouseholdMovement $movement): array => [
                'id' => $movement->id,
                'action' => $movement->action->value,
                'created_at' => $movement->created_at->toIso8601String(),
                'user' => $movement->user === null ? null : ['id' => $movement->user->id, 'name' => $movement->user->name],
                'subject' => $movement->subject === null ? null : ['id' => $movement->subject->id, 'name' => $movement->subject->name],
                'batch_id' => $movement->batch_id,
                'product_name' => $movement->product_name,
                'quantity' => $movement->quantity,
                'changes' => $movement->changes,
            ])->values()->all(),
            'meta' => [
                'next_before' => $hasMore ? $page->last()?->id : null,
            ],
        ]);
    }

    public function removeMember(Request $request, Household $household, User $user): JsonResponse
    {
        $this->authorize('removeMembers', $household);

        if ($household->roleOf($user) === HouseholdRole::Owner) {
            return response()->json(['message' => 'The owner cannot be removed.'], 422);
        }

        DB::transaction(function () use ($request, $household, $user): void {
            $household->users()->detach($user->id);
            HouseholdMovement::forHousehold($household, MovementAction::MemberRemoved, $request->user(), $user);
        });

        return response()->json(['message' => 'Member removed.']);
    }

    public function updateMemberRole(Request $request, Household $household, User $user): JsonResponse
    {
        $this->authorize('removeMembers', $household);

        $validated = $request->validate([
            'role' => ['required', Rule::in([HouseholdRole::Manager->value, HouseholdRole::Member->value])],
        ]);

        if ($household->roleOf($user) === HouseholdRole::Owner) {
            return response()->json(['message' => 'The owner role cannot be changed.'], 422);
        }

        DB::transaction(function () use ($request, $household, $user, $validated): void {
            $before = $household->roleOf($user)?->value;
            $household->users()->updateExistingPivot($user->id, ['role' => $validated['role']]);

            if ($before !== $validated['role']) {
                HouseholdMovement::forHousehold($household, MovementAction::MemberRoleChanged, $request->user(), $user, [
                    'role' => [$before, $validated['role']],
                ]);
            }
        });

        return response()->json([
            'message' => 'Member role updated.',
            'member' => [
                'id' => $user->id,
                'role' => $validated['role'],
            ],
        ]);
    }

    private function operationsCount(Household $household, User $user): int
    {
        return HouseholdMovement::query()
            ->where('household_id', $household->id)
            ->where('user_id', $user->id)
            ->count();
    }
}
