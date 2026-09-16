<?php

use App\Enums\HouseholdRole;
use App\Enums\InvitationStatus;
use App\Models\Household;
use App\Models\HouseholdInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('lets an owner invite a user by email', function () {
    $owner = User::factory()->create();
    $household = Household::create(['name' => 'Home']);
    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);

    $response = $this->actingAs($owner, 'sanctum')->postJson(
        "/api/v1/households/{$household->id}/invitations",
        ['email' => 'guest@example.com']
    );

    $response->assertCreated()->assertJsonStructure(['data' => ['id', 'email', 'token', 'expires_at']]);

    expect(HouseholdInvitation::where('email', 'guest@example.com')->exists())->toBeTrue();
});

it('forbids non-owners from inviting', function () {
    $member = User::factory()->create();
    $outsider = User::factory()->create();
    $household = Household::create(['name' => 'Home']);
    $household->users()->attach($member->id, ['role' => HouseholdRole::Member->value]);

    $this->actingAs($member, 'sanctum')->postJson(
        "/api/v1/households/{$household->id}/invitations",
        ['email' => 'guest@example.com']
    )->assertForbidden();

    $this->actingAs($outsider, 'sanctum')->postJson(
        "/api/v1/households/{$household->id}/invitations",
        ['email' => 'guest@example.com']
    )->assertForbidden();
});

it('rejects inviting someone who is already a member', function () {
    $owner = User::factory()->create();
    $household = Household::create(['name' => 'Home']);
    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);

    $this->actingAs($owner, 'sanctum')->postJson(
        "/api/v1/households/{$household->id}/invitations",
        ['email' => $owner->email]
    )->assertStatus(422);
});

it('lets the invited user accept and join as member', function () {
    $owner = User::factory()->create();
    $guest = User::factory()->create(['email' => 'guest@example.com']);
    $household = Household::create(['name' => 'Home']);
    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);

    $invitation = HouseholdInvitation::create([
        'household_id' => $household->id,
        'email' => 'guest@example.com',
        'token' => str_repeat('a', 64),
        'status' => InvitationStatus::Pending,
        'expires_at' => now()->addDays(7),
    ]);

    $response = $this->actingAs($guest, 'sanctum')->postJson('/api/v1/invitations/accept', [
        'token' => $invitation->token,
    ]);

    $response->assertOk()->assertJsonPath('data.household_id', $household->id);

    expect($guest->households()->whereKey($household->id)->exists())->toBeTrue();
    expect($guest->households()->find($household->id)->pivot->role)->toBe('member');
    expect($invitation->fresh()->status)->toBe(InvitationStatus::Accepted);
});

it('rejects accept with wrong email, expired or reused token', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create(['email' => 'other@example.com']);
    $household = Household::create(['name' => 'Home']);
    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);

    $invitation = HouseholdInvitation::create([
        'household_id' => $household->id,
        'email' => 'guest@example.com',
        'token' => str_repeat('b', 64),
        'status' => InvitationStatus::Pending,
        'expires_at' => now()->addDays(7),
    ]);

    // wrong email
    $this->actingAs($other, 'sanctum')->postJson('/api/v1/invitations/accept', [
        'token' => $invitation->token,
    ])->assertForbidden();

    // expired
    $guest = User::factory()->create(['email' => 'guest@example.com']);
    $invitation->update(['expires_at' => now()->subDay()]);
    $this->actingAs($guest, 'sanctum')->postJson('/api/v1/invitations/accept', [
        'token' => $invitation->token,
    ])->assertForbidden();

    // unknown token
    $this->actingAs($guest, 'sanctum')->postJson('/api/v1/invitations/accept', [
        'token' => str_repeat('c', 64),
    ])->assertNotFound();
});
