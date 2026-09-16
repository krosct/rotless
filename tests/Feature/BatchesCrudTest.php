<?php

use App\Enums\BatchStatus;
use App\Enums\HouseholdRole;
use App\Models\Batch;
use App\Models\Household;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function memberHousehold(): array
{
    $user = User::factory()->create();
    $household = Household::create(['name' => 'Home']);
    $household->users()->attach($user->id, ['role' => HouseholdRole::Owner->value]);

    return [$user, $household];
}

function fakeOpenFoodFacts(string $barcode, string $name): void
{
    Http::fake([
        "world.openfoodfacts.org/api/v2/product/{$barcode}.json" => Http::response([
            'status' => 1,
            'product' => ['product_name' => $name, 'brands' => 'Test Brand'],
        ], 200),
    ]);
}

it('creates a batch from a barcode via openfoodfacts and caches the product', function () {
    [$user, $household] = memberHousehold();
    fakeOpenFoodFacts('3017620422003', 'Nutella');

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'barcode' => '3017620422003',
        'quantity' => 2,
        'expires_at' => now()->addDays(30)->toDateString(),
    ]);

    $response->assertCreated()->assertJsonPath('data.product.name', 'Nutella');

    $product = Product::where('barcode', '3017620422003')->first();
    expect($product)->not->toBeNull()
        ->and($product->openfoodfacts_data['brands'])->toBe('Test Brand');
});

it('reuses the cached product on a second scan without http', function () {
    [$user, $household] = memberHousehold();
    Product::create(['name' => 'Nutella', 'barcode' => '3017620422003']);

    Http::fake();
    Http::preventStrayRequests();

    $this->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'barcode' => '3017620422003',
        'expires_at' => now()->addDays(30)->toDateString(),
    ])->assertCreated();

    Http::assertNothingSent();
});

it('rejects an unknown barcode', function () {
    [$user, $household] = memberHousehold();

    Http::fake([
        'world.openfoodfacts.org/*' => Http::response(['status' => 0], 200),
    ]);

    $this->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'barcode' => '0000000000000',
        'expires_at' => now()->addDays(30)->toDateString(),
    ])->assertStatus(422)->assertJsonPath('message', 'Product not found for this barcode.');
});

it('creates a manual product with photo upload', function () {
    [$user, $household] = memberHousehold();
    Storage::fake('public');

    $response = $this->actingAs($user, 'sanctum')->post('/api/v1/batches', [
        'household_id' => $household->id,
        'name' => 'Feira apples',
        'quantity' => 5,
        'expires_at' => now()->addDays(7)->toDateString(),
        'photo' => UploadedFile::fake()->image('apples.jpg'),
    ]);

    $response->assertCreated()->assertJsonPath('data.product.name', 'Feira apples');

    $path = Product::where('name', 'Feira apples')->first()->photo_path;
    Storage::disk('public')->assertExists($path);
});

it('rejects batch creation without barcode or name, or with past expiry', function () {
    [$user, $household] = memberHousehold();

    $this->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'expires_at' => now()->addDays(7)->toDateString(),
    ])->assertStatus(422)->assertJsonValidationErrors(['barcode', 'name']);

    $this->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $household->id,
        'name' => 'Old milk',
        'expires_at' => now()->subDay()->toDateString(),
    ])->assertStatus(422)->assertJsonValidationErrors(['expires_at']);
});

it('forbids creating batches in other households', function () {
    [$user] = memberHousehold();
    $otherHousehold = Household::create(['name' => 'Other']);

    $this->actingAs($user, 'sanctum')->postJson('/api/v1/batches', [
        'household_id' => $otherHousehold->id,
        'name' => 'Sneaky item',
        'expires_at' => now()->addDays(7)->toDateString(),
    ])->assertForbidden();
});

it('shows, updates and deletes a batch with policy checks', function () {
    [$user, $household] = memberHousehold();
    $outsider = User::factory()->create();
    $product = Product::create(['name' => 'Rice']);
    $batch = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => now()->addDays(10)->toDateString(),
        'status' => BatchStatus::Active,
    ]);

    $this->actingAs($user, 'sanctum')->getJson("/api/v1/batches/{$batch->id}")
        ->assertOk()->assertJsonPath('data.quantity', 1);
    $this->actingAs($outsider, 'sanctum')->getJson("/api/v1/batches/{$batch->id}")
        ->assertForbidden();

    $this->actingAs($user, 'sanctum')->patchJson("/api/v1/batches/{$batch->id}", [
        'status' => 'consumed',
    ])->assertOk()->assertJsonPath('data.status', 'consumed');
    expect($batch->fresh()->status)->toBe(BatchStatus::Consumed);

    $this->actingAs($outsider, 'sanctum')->patchJson("/api/v1/batches/{$batch->id}", [
        'status' => 'discarded',
    ])->assertForbidden();

    $this->actingAs($outsider, 'sanctum')->deleteJson("/api/v1/batches/{$batch->id}")
        ->assertForbidden();
    $this->actingAs($user, 'sanctum')->deleteJson("/api/v1/batches/{$batch->id}")
        ->assertNoContent();
    expect(Batch::find($batch->id))->toBeNull();
});
