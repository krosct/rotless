<?php

use App\Enums\BatchStatus;
use App\Enums\HouseholdRole;
use App\Models\Batch;
use App\Models\Household;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('registers a user and returns a token', function () {
    $response = $this->postJson('/api/v1/register', [
        'name' => 'PH',
        'email' => 'ph@example.com',
        'password' => 'supersecret',
    ]);

    $response->assertCreated()
        ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);

    expect(User::where('email', 'ph@example.com')->exists())->toBeTrue();
});

it('rejects registration with invalid data', function () {
    $this->postJson('/api/v1/register', [
        'name' => '',
        'email' => 'not-an-email',
        'password' => 'short',
    ])->assertStatus(422)->assertJsonValidationErrors(['name', 'email', 'password']);
});

it('logs in with valid credentials and rejects invalid ones', function () {
    User::factory()->create([
        'email' => 'ph@example.com',
        'password' => 'supersecret',
    ]);

    $this->postJson('/api/v1/login', [
        'email' => 'ph@example.com',
        'password' => 'supersecret',
    ])->assertOk()->assertJsonStructure(['token']);

    $this->postJson('/api/v1/login', [
        'email' => 'ph@example.com',
        'password' => 'wrongpassword',
    ])->assertStatus(422);
});

it('requires authentication to list batches', function () {
    $this->getJson('/api/v1/batches')->assertStatus(401);
});

it('lists only batches from households the user belongs to', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $myHousehold = Household::create(['name' => 'My Home']);
    $otherHousehold = Household::create(['name' => 'Other Home']);
    $myHousehold->users()->attach($user->id, ['role' => HouseholdRole::Owner->value]);
    $otherHousehold->users()->attach($otherUser->id, ['role' => HouseholdRole::Owner->value]);

    $myProduct = Product::create(['name' => 'Rice']);
    $otherProduct = Product::create(['name' => 'Beans']);

    $myBatch = Batch::create([
        'household_id' => $myHousehold->id,
        'product_id' => $myProduct->id,
        'quantity' => 2,
        'expires_at' => '2026-10-01',
        'status' => BatchStatus::Active,
    ]);
    Batch::create([
        'household_id' => $otherHousehold->id,
        'product_id' => $otherProduct->id,
        'quantity' => 1,
        'expires_at' => '2026-09-20',
        'status' => BatchStatus::Active,
    ]);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/v1/batches');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toHaveCount(1)->toContain($myBatch->id);
});

it('logs out and invalidates the token', function () {
    $user = User::factory()->create();

    $token = $user->createToken('auth')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/logout')->assertOk();

    // Guard instances are process-wide singletons; a real HTTP request would
    // start with fresh guards. Reset them to emulate a new request lifecycle.
    auth()->forgetGuards();

    $this->withToken($token)->getJson('/api/v1/batches')->assertStatus(401);
});
