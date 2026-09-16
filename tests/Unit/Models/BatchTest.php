<?php

use App\Enums\BatchStatus;
use App\Enums\HouseholdRole;
use App\Models\Batch;
use App\Models\Household;
use App\Models\NotificationLog;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('belongs to a household and a product', function () {
    $household = Household::create(['name' => 'Home']);
    $product = Product::create(['name' => 'Rice']);
    $batch = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 2,
        'expires_at' => '2026-10-01',
        'status' => BatchStatus::Active,
    ]);

    expect($batch->household->id)->toBe($household->id)
        ->and($batch->product->id)->toBe($product->id)
        ->and($batch->status)->toBe(BatchStatus::Active)
        ->and($batch->expires_at->format('Y-m-d'))->toBe('2026-10-01');
});

it('scopes active batches only', function () {
    $household = Household::create(['name' => 'Home']);
    $product = Product::create(['name' => 'Rice']);
    $active = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'expires_at' => '2026-10-01',
        'status' => BatchStatus::Active,
    ]);
    Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'expires_at' => '2026-10-02',
        'status' => BatchStatus::Consumed,
    ]);

    $ids = $household->batches()->active()->pluck('id');

    expect($ids)->toHaveCount(1)->toContain($active->id);
});

it('links users to households with roles', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $household = Household::create(['name' => 'Home']);

    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);
    $household->users()->attach($member->id, ['role' => HouseholdRole::Member->value]);

    expect($owner->households->first()->pivot->role)->toBe('owner')
        ->and($member->households->first()->pivot->role)->toBe('member')
        ->and($household->users)->toHaveCount(2);
});

it('logs a notification for a batch and user', function () {
    $household = Household::create(['name' => 'Home']);
    $user = User::factory()->create();
    $product = Product::create(['name' => 'Rice']);
    $batch = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'expires_at' => '2026-10-01',
        'status' => BatchStatus::Active,
    ]);

    $log = NotificationLog::create([
        'household_id' => $household->id,
        'user_id' => $user->id,
        'batch_id' => $batch->id,
        'channel' => 'telegram',
        'status' => 'sent',
        'sent_at' => now(),
    ]);

    expect($log->user->id)->toBe($user->id)
        ->and($log->batch->id)->toBe($batch->id)
        ->and($log->household->id)->toBe($household->id);
});
