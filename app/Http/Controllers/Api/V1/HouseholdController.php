<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\HouseholdRole;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Household;
use App\Models\User;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class HouseholdController extends Controller
{
    use AuthorizesRequests;

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

        $operatorIds = Batch::query()
            ->where('household_id', $household->id)
            ->where(function ($builder): void {
                $builder->whereNotNull('created_by')->orWhereNotNull('updated_by');
            })
            ->get(['created_by', 'updated_by'])
            ->flatMap(fn (Batch $batch): array => array_filter([$batch->created_by, $batch->updated_by]))
            ->unique()
            ->values()
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

    public function activities(Request $request, Household $household): JsonResponse
    {
        $this->authorize('manageMembers', $household);

        $query = Batch::query()
            ->with(['product', 'creator', 'updater'])
            ->where('household_id', $household->id)
            ->orderByDesc('updated_at');

        if ($request->filled('user_id')) {
            $userId = $request->integer('user_id');
            $query->where(function ($builder) use ($userId): void {
                $builder->where('created_by', $userId)
                    ->orWhere('updated_by', $userId);
            });
        }

        if ($request->filled('action')) {
            $action = $request->string('action')->toString();
            if ($action === 'created') {
                $query->whereNotNull('created_by');
            } elseif ($action === 'updated') {
                $query->whereNotNull('updated_by')->whereColumn('updated_by', '!=', 'created_by');
            }
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->whereHas('product', fn ($builder) => $builder->whereLike('name', "%{$search}%", caseSensitive: false));
        }

        $activities = $query->get()->map(fn (Batch $batch): array => [
            'batch_id' => $batch->id,
            'product_name' => $batch->product->name,
            'quantity' => $batch->quantity,
            'expires_at' => $batch->expires_at->toDateString(),
            'status' => $batch->status->value,
            'created_at' => $batch->created_at?->toIso8601String(),
            'updated_at' => $batch->updated_at?->toIso8601String(),
            'created_by' => $batch->creator === null ? null : [
                'id' => $batch->creator->id,
                'name' => $batch->creator->name,
            ],
            'updated_by' => $batch->updater === null ? null : [
                'id' => $batch->updater->id,
                'name' => $batch->updater->name,
            ],
        ])->values()->all();

        return response()->json(['data' => $activities]);
    }

    public function removeMember(Request $request, Household $household, User $user): JsonResponse
    {
        $this->authorize('manageMembers', $household);

        $isOwner = $household->users()
            ->whereKey($user->id)
            ->wherePivot('role', HouseholdRole::Owner->value)
            ->exists();

        if ($isOwner) {
            return response()->json(['message' => 'The owner cannot be removed.'], 422);
        }

        $household->users()->detach($user->id);

        return response()->json(['message' => 'Member removed.']);
    }

    private function operationsCount(Household $household, User $user): int
    {
        return Batch::query()
            ->where('household_id', $household->id)
            ->where(function ($builder) use ($user): void {
                $builder->where('created_by', $user->id)
                    ->orWhere('updated_by', $user->id);
            })
            ->count();
    }
}
