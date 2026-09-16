<?php

declare(strict_types=1);

use App\Enums\BatchStatus;
use App\Models\Batch;
use App\Models\Household;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('finds active batches expiring within the window', function () {
    $household = Household::create(['name' => 'Home']);
    $product = Product::create(['name' => 'Rice']);

    $inside = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDays(2)->toDateString(),
        'status' => BatchStatus::Active,
    ]);
    Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDays(10)->toDateString(),
        'status' => BatchStatus::Active,
    ]);

    $ids = Batch::query()->active()->expiringWithin(3)->pluck('id');

    expect($ids)->toHaveCount(1)->toContain($inside->id);
});

it('includes batches expiring exactly on the boundary day', function () {
    $household = Household::create(['name' => 'Home']);
    $product = Product::create(['name' => 'Rice']);

    $boundary = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDays(3)->toDateString(),
        'status' => BatchStatus::Active,
    ]);

    $ids = Batch::query()->active()->expiringWithin(3)->pluck('id');

    expect($ids)->toContain($boundary->id);
});

it('excludes already expired batches', function () {
    $household = Household::create(['name' => 'Home']);
    $product = Product::create(['name' => 'Rice']);

    Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->subDay()->toDateString(),
        'status' => BatchStatus::Active,
    ]);

    $ids = Batch::query()->active()->expiringWithin(3)->pluck('id');

    expect($ids)->toHaveCount(0);
});
