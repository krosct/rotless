<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** @return array<string, string> */
function loginPayload(string $email = 'victim@example.com'): array
{
    return ['email' => $email, 'password' => 'wrong-password'];
}

it('blocks the sixth login attempt for the same account from the same IP', function () {
    User::factory()->create(['email' => 'victim@example.com']);

    foreach (range(1, 5) as $attempt) {
        $this->postJson('/api/v1/login', loginPayload())->assertStatus(422);
    }

    $this->postJson('/api/v1/login', loginPayload())
        ->assertStatus(429)
        ->assertHeader('Retry-After')
        ->assertJsonStructure(['message']);
});

it('also blocks the correct password once the account is locked', function () {
    User::factory()->create(['email' => 'victim@example.com', 'password' => 'right-password']);

    foreach (range(1, 5) as $attempt) {
        $this->postJson('/api/v1/login', loginPayload());
    }

    $this->postJson('/api/v1/login', ['email' => 'victim@example.com', 'password' => 'right-password'])
        ->assertStatus(429);
});

it('caps credential stuffing across many accounts from one IP', function () {
    foreach (range(1, 20) as $i) {
        $this->postJson('/api/v1/login', loginPayload("user{$i}@example.com"))->assertStatus(422);
    }

    $this->postJson('/api/v1/login', loginPayload('user21@example.com'))->assertStatus(429);
});

it('caps a distributed attack on one account from many IPs', function () {
    foreach (range(1, 10) as $i) {
        $this->withServerVariables(['REMOTE_ADDR' => "203.0.113.{$i}"])
            ->postJson('/api/v1/login', loginPayload())
            ->assertStatus(422);
    }

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.99'])
        ->postJson('/api/v1/login', loginPayload())
        ->assertStatus(429);
});

it('treats the email case-insensitively when counting attempts', function () {
    foreach (range(1, 5) as $attempt) {
        $this->postJson('/api/v1/login', loginPayload('Victim@Example.com'));
    }

    $this->postJson('/api/v1/login', loginPayload('victim@example.com'))->assertStatus(429);
});

it('uses the forwarded client IP only behind a trusted proxy', function () {
    // Behind Caddy (private network): each forwarded client gets its own limit.
    foreach (range(1, 5) as $attempt) {
        $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.5', 'HTTP_X_FORWARDED_FOR' => '198.51.100.1'])
            ->postJson('/api/v1/login', loginPayload());
    }

    $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.5', 'HTTP_X_FORWARDED_FOR' => '198.51.100.2'])
        ->postJson('/api/v1/login', loginPayload())
        ->assertStatus(422);

    // From the internet: a spoofed header does not grant a fresh limit.
    foreach (range(1, 5) as $attempt) {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.50', 'HTTP_X_FORWARDED_FOR' => "198.51.100.{$attempt}0"])
            ->postJson('/api/v1/login', loginPayload('other@example.com'));
    }

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.50', 'HTTP_X_FORWARDED_FOR' => '198.51.100.99'])
        ->postJson('/api/v1/login', loginPayload('other@example.com'))
        ->assertStatus(429);
});

it('limits account creation per IP', function () {
    foreach (range(1, 10) as $i) {
        $this->postJson('/api/v1/register', [
            'name' => "User {$i}",
            'email' => "new{$i}@example.com",
            'password' => 'password123',
        ])->assertCreated();
    }

    $this->postJson('/api/v1/register', [
        'name' => 'User 11',
        'email' => 'new11@example.com',
        'password' => 'password123',
    ])->assertStatus(429);
});

it('limits current-password guesses on the password change endpoint', function () {
    $user = User::factory()->create(['password' => 'oldpassword']);

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($user, 'sanctum')->patchJson('/api/v1/user/password', [
            'current_password' => "guess-{$attempt}",
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertStatus(422);
    }

    $this->actingAs($user, 'sanctum')->patchJson('/api/v1/user/password', [
        'current_password' => 'oldpassword',
        'password' => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertStatus(429);
});

it('throttles the public invitation lookup per IP', function () {
    foreach (range(1, 30) as $attempt) {
        $this->getJson("/api/v1/invitations/info/guess-{$attempt}");
    }

    $this->getJson('/api/v1/invitations/info/guess-31')->assertStatus(429);
});
