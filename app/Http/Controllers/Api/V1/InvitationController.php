<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\HouseholdRole;
use App\Enums\InvitationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\AcceptInvitationRequest;
use App\Http\Requests\StoreInvitationRequest;
use App\Models\Household;
use App\Models\HouseholdInvitation;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class InvitationController extends Controller
{
    use AuthorizesRequests;

    public function store(StoreInvitationRequest $request, Household $household): JsonResponse
    {
        $this->authorize('manageMembers', $household);

        if ($household->users()->where('email', $request->string('email'))->exists()) {
            return response()->json(['message' => 'User is already a member.'], 422);
        }

        $invitation = HouseholdInvitation::create([
            'household_id' => $household->id,
            'email' => $request->string('email'),
            'token' => Str::random(64),
            'status' => InvitationStatus::Pending,
            'expires_at' => now()->addDays(HouseholdInvitation::VALID_DAYS),
        ]);

        return response()->json([
            'data' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'token' => $invitation->token,
                'expires_at' => $invitation->expires_at->toDateTimeString(),
            ],
        ], 201);
    }

    public function accept(AcceptInvitationRequest $request): JsonResponse
    {
        $invitation = HouseholdInvitation::where('token', $request->string('token'))->firstOrFail();

        $this->authorize('accept', $invitation);

        DB::transaction(function () use ($invitation, $request): void {
            $invitation->household->users()->syncWithoutDetaching([
                $request->user()->id => ['role' => HouseholdRole::Member->value],
            ]);

            $invitation->update(['status' => InvitationStatus::Accepted]);
        });

        return response()->json([
            'data' => [
                'household_id' => $invitation->household_id,
                'household_name' => $invitation->household->name,
            ],
        ]);
    }
}
