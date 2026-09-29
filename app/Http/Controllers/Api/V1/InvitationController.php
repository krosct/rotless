<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\HouseholdRole;
use App\Enums\InvitationStatus;
use App\Enums\MovementAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\AcceptInvitationRequest;
use App\Http\Requests\StoreInvitationRequest;
use App\Models\Household;
use App\Models\HouseholdInvitation;
use App\Models\HouseholdMovement;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        $invitation = DB::transaction(function () use ($request, $household): HouseholdInvitation {
            $invitation = HouseholdInvitation::create([
                'household_id' => $household->id,
                'email' => $request->string('email'),
                'token' => Str::random(64),
                'status' => InvitationStatus::Pending,
                'expires_at' => now()->addDays(HouseholdInvitation::VALID_DAYS),
            ]);

            HouseholdMovement::forHousehold($household, MovementAction::MemberInvited, $request->user(), null, [
                'email' => [null, $invitation->email],
            ]);

            return $invitation;
        });

        return response()->json([
            'message' => 'Invitation created.',
            'invitation' => [
                'token' => $invitation->token,
                'email' => $invitation->email,
                'household_name' => $household->name,
                'invite_url' => url("/invite/{$invitation->token}"),
                'expires_at' => $invitation->expires_at->toDateTimeString(),
            ],
        ], 201);
    }

    public function info(Request $request, string $token): JsonResponse
    {
        $invitation = HouseholdInvitation::where('token', $token)->firstOrFail();

        $user = $request->user('sanctum');
        $isMember = $user !== null
            && $invitation->household->users()->whereKey($user->id)->exists();
        $isInvited = $user !== null && $user->email === $invitation->email;

        $state = match (true) {
            $isMember => 'already_member',
            $isInvited => 'invited',
            default => 'not_invited',
        };

        return response()->json([
            'token' => $invitation->token,
            'email' => $invitation->email,
            'household_id' => $invitation->household_id,
            'household_name' => $invitation->household->name,
            'expires_at' => $invitation->expires_at->toDateTimeString(),
            'state' => $state,
        ]);
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

            HouseholdMovement::forHousehold($invitation->household, MovementAction::MemberJoined, $request->user(), $request->user());
        });

        return response()->json([
            'message' => 'Invitation accepted.',
            'household' => [
                'id' => $invitation->household_id,
                'name' => $invitation->household->name,
                'role' => 'member',
            ],
        ]);
    }
}
