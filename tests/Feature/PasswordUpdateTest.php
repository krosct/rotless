<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it('updates the password when the current one matches', function () {
    $user = User::factory()->create(['password' => 'oldpassword']);

    $this->actingAs($user, 'sanctum')->patchJson('/api/v1/user/password', [
        'current_password' => 'oldpassword',
        'password' => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertOk();

    expect(Hash::check('newpassword123', $user->fresh()->password))->toBeTrue();
});

it('rejects the update when the current password is wrong', function () {
    $user = User::factory()->create(['password' => 'oldpassword']);

    $this->actingAs($user, 'sanctum')->patchJson('/api/v1/user/password', [
        'current_password' => 'wrongpassword',
        'password' => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertStatus(422)->assertJsonValidationErrors(['current_password']);

    expect(Hash::check('oldpassword', $user->fresh()->password))->toBeTrue();
});

it('rejects the update when the confirmation does not match', function () {
    $user = User::factory()->create(['password' => 'oldpassword']);

    $this->actingAs($user, 'sanctum')->patchJson('/api/v1/user/password', [
        'current_password' => 'oldpassword',
        'password' => 'newpassword123',
        'password_confirmation' => 'different123',
    ])->assertStatus(422)->assertJsonValidationErrors(['password']);
});

it('rejects the update when the new password is too short', function () {
    $user = User::factory()->create(['password' => 'oldpassword']);

    $this->actingAs($user, 'sanctum')->patchJson('/api/v1/user/password', [
        'current_password' => 'oldpassword',
        'password' => 'short',
        'password_confirmation' => 'short',
    ])->assertStatus(422)->assertJsonValidationErrors(['password']);
});

it('requires authentication to update the password', function () {
    $this->patchJson('/api/v1/user/password', [
        'current_password' => 'oldpassword',
        'password' => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertUnauthorized();
});
