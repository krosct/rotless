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

    public function activities(Request $request, Household $household, User $user): JsonResponse
    {
        $this->authorize('view', $household);

        $isMember = $household->users()->whereKey($user->id)->exists();
        abort_unless($isMember, 404);

        $query = Batch::query()
            ->with('product')
            ->where('household_id', $household->id)
            ->where(function ($builder) use ($user): void {
                $builder->where('created_by', $user->id)
                    ->orWhere('updated_by', $user->id);
            })
            ->orderByDesc('updated_at');

        if ($request->filled('action')) {
            $action = $request->string('action')->toString();
            if ($action === 'created') {
                $query->where('created_by', $user->id);
            } elseif ($action === 'updated') {
                $query->where('updated_by', $user->id)->whereColumn('updated_by', '!=', 'created_by');
            }
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->whereHas('product', fn ($builder) => $builder->where('name', 'ilike', "%{$search}%"));
        }

        $activities = $query->get()->map(function (Batch $batch) use ($user): array {
            $isCreator = $batch->created_by === $user->id;
            $isUpdater = $batch->updated_by === $user->id;

            return [
                'batch_id' => $batch->id,
                'product_name' => $batch->product->name,
                'quantity' => $batch->quantity,
                'expires_at' => $batch->expires_at->toDateString(),
                'status' => $batch->status->value,
                'created_at' => $batch->created_at?->toIso8601String(),
                'updated_at' => $batch->updated_at?->toIso8601String(),
                'created_by_this_user' => $isCreator,
                'updated_by_this_user' => $isUpdater,
            ];
        })->values()->all();

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
