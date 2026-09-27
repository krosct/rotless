<?php

declare(strict_types=1);

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
    config()->set('services.telegram.test_chat_id', '123456');
});

it('creates fixtures, sends the alert and cleans everything up', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $this->artisan('app:telegram-smoke')->assertSuccessful();

    Http::assertSent(fn ($request) => str_contains((string) $request['text'], 'Telegram Smoke Product'));

    expect(NotificationLog::count())->toBe(0)
        ->and(Batch::count())->toBe(0)
        ->and(Product::count())->toBe(0)
        ->and(Household::count())->toBe(0)
        ->and(User::where('email', 'like', 'telegram-smoke-%')->count())->toBe(0);
});

it('logs the delivery when a real api is faked', function () {
    Http::fake([
        '*' => Http::response(['ok' => true], 200),
    ]);

    $this->artisan('app:telegram-smoke')->assertSuccessful();

    Http::assertSentCount(1);
});

it('fails when the bot token is missing', function () {
    config()->set('services.telegram.bot_token', '');

    $this->artisan('app:telegram-smoke')->assertFailed();
});

it('fails when the test chat id is missing', function () {
    config()->set('services.telegram.test_chat_id', '');

    $this->artisan('app:telegram-smoke')->assertFailed();
});
