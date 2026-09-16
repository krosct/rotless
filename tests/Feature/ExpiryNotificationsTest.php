<?php

use App\Enums\BatchStatus;
use App\Enums\HouseholdRole;
use App\Models\Batch;
use App\Models\Household;
use App\Models\NotificationLog;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config()->set('services.telegram.bot_token', 'test-token');
});

it('sends one telegram message per member with chat id and logs sent', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $household = Household::create(['name' => 'Home']);
    $owner = User::factory()->create(['telegram_chat_id' => '111']);
    $member = User::factory()->create(['telegram_chat_id' => '222']);
    $household->users()->attach($owner->id, ['role' => HouseholdRole::Owner->value]);
    $household->users()->attach($member->id, ['role' => HouseholdRole::Member->value]);
    $product = Product::create(['name' => 'Milk']);
    $batch = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDay()->toDateString(),
        'status' => BatchStatus::Active,
    ]);

    $this->artisan('app:check-expiring-batches')->assertSuccessful();

    Http::assertSentCount(2);
    Http::assertSent(fn ($request) => str_contains((string) $request['text'], 'Milk'));
    expect(NotificationLog::where('batch_id', $batch->id)->where('status', 'sent')->count())->toBe(2);
});

it('skips members without a telegram chat id', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $household = Household::create(['name' => 'Home']);
    $withChat = User::factory()->create(['telegram_chat_id' => '111']);
    $withoutChat = User::factory()->create(['telegram_chat_id' => null]);
    $household->users()->attach($withChat->id, ['role' => HouseholdRole::Owner->value]);
    $household->users()->attach($withoutChat->id, ['role' => HouseholdRole::Member->value]);
    $product = Product::create(['name' => 'Milk']);
    $batch = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDay()->toDateString(),
        'status' => BatchStatus::Active,
    ]);

    $this->artisan('app:check-expiring-batches')->assertSuccessful();

    Http::assertSentCount(1);
    expect(NotificationLog::where('batch_id', $batch->id)->count())->toBe(1);
});

it('does not notify batches outside the window or already consumed or discarded', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $household = Household::create(['name' => 'Home']);
    $user = User::factory()->create(['telegram_chat_id' => '111']);
    $household->users()->attach($user->id, ['role' => HouseholdRole::Owner->value]);
    $product = Product::create(['name' => 'Milk']);

    Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDays(30)->toDateString(),
        'status' => BatchStatus::Active,
    ]);
    Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDay()->toDateString(),
        'status' => BatchStatus::Consumed,
    ]);
    Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDay()->toDateString(),
        'status' => BatchStatus::Discarded,
    ]);

    $this->artisan('app:check-expiring-batches')->assertSuccessful();

    Http::assertNothingSent();
    expect(NotificationLog::query()->count())->toBe(0);
});

it('logs failed with error message without breaking the other member', function () {
    Http::fake(function ($request) {
        if (($request['chat_id'] ?? null) === 'bad-chat') {
            return Http::response(['ok' => false], 500);
        }

        return Http::response(['ok' => true], 200);
    });

    $household = Household::create(['name' => 'Home']);
    $good = User::factory()->create(['telegram_chat_id' => 'good-chat']);
    $bad = User::factory()->create(['telegram_chat_id' => 'bad-chat']);
    $household->users()->attach($good->id, ['role' => HouseholdRole::Owner->value]);
    $household->users()->attach($bad->id, ['role' => HouseholdRole::Member->value]);
    $product = Product::create(['name' => 'Milk']);
    $batch = Batch::create([
        'household_id' => $household->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'expires_at' => today()->addDay()->toDateString(),
        'status' => BatchStatus::Active,
    ]);

    $this->artisan('app:check-expiring-batches')->assertSuccessful();

    expect(NotificationLog::where('batch_id', $batch->id)->where('status', 'sent')->count())->toBe(1);

    $failed = NotificationLog::where('batch_id', $batch->id)->where('status', 'failed')->first();
    expect($failed)->not->toBeNull()
        ->and($failed->error_message)->not->toBeNull()
        ->and($failed->user_id)->toBe($bad->id);
});
