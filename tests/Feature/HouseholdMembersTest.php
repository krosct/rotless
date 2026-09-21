<?php

use App\Enums\BatchStatus;
use App\Enums\HouseholdRole;
use App\Models\Batch;
use App\Models\Household;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function householdWithMembers(): array
{
    $owner = User::factory()->create(['name' => 'Owner']);
    $member = User::factory()->create(['name' => 'Member']);
    $household = Household::create(['name' => 'Home']);
    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);
    $household->users()->attach($member->id, ['role' => HouseholdRole::Member->value]);

    return [$owner, $member, $household];
}

it('lists members with joined date and operations count', function () {
    [$owner, $member, $household] = householdWithMembers();
    $product = Product::create(['name' => 'Rice']);

    Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => now()->addDays(5)->toDateString(),
        'status' => BatchStatus::Active,
        'created_by' => $member->id,
        'updated_by' => $member->id,
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/members");

    $response->assertOk()->assertJsonCount(2, 'data');

    $memberRow = collect($response->json('data'))->firstWhere('id', $member->id);
    expect($memberRow['role'])->toBe('member')
        ->and($memberRow['operations_count'])->toBe(1)
        ->and($memberRow['joined_at'])->not->toBeNull();
});

it('lists activities of a member with filters', function () {
    [$owner, $member, $household] = householdWithMembers();
    $rice = Product::create(['name' => 'Rice']);
    $beans = Product::create(['name' => 'Beans']);

    Batch::create([
        'household_id' => $household->id,
        'product_id' => $rice->id,
        'quantity' => 1,
        'expires_at' => now()->addDays(5)->toDateString(),
        'status' => BatchStatus::Active,
        'created_by' => $member->id,
        'updated_by' => $member->id,
    ]);

    Batch::create([
        'household_id' => $household->id,
        'product_id' => $beans->id,
        'quantity' => 2,
        'expires_at' => now()->addDays(9)->toDateString(),
        'status' => BatchStatus::Consumed,
        'created_by' => $owner->id,
        'updated_by' => $member->id,
    ]);

    $all = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/members/{$member->id}/activities");
    $all->assertOk()->assertJsonCount(2, 'data');

    $search = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/members/{$member->id}/activities?search=Rice");
    $search->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.product_name', 'Rice');

    $status = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/households/{$household->id}/members/{$member->id}/activities?status=consumed");
    $status->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.product_name', 'Beans');
});

it('lets only the owner remove a member and never the owner', function () {
    [$owner, $member, $household] = householdWithMembers();

    $this->actingAs($member, 'sanctum')
        ->deleteJson("/api/v1/households/{$household->id}/members/{$owner->id}")
        ->assertForbidden();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/households/{$household->id}/members/{$owner->id}")
        ->assertStatus(422);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/households/{$household->id}/members/{$member->id}")
        ->assertOk();

    expect($household->users()->whereKey($member->id)->exists())->toBeFalse();
});
