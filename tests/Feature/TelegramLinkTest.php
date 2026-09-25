<?php

declare(strict_types=1);

use App\Models\TelegramLinkToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config()->set('services.telegram.bot_token', 'test-token');
    config()->set('services.telegram.bot_username', 'rotless_bot');
    config()->set('services.telegram.webhook_secret', 'webhook-secret');
    config()->set('app.url', 'https://rotless.test');
});

it('returns a single-use deep link for the authenticated user', function () {
    Http::fake([
        'https://api.telegram.org/bottest-token/getMe' => Http::response(['ok' => true, 'result' => ['username' => 'rotless_bot']], 200),
        '*' => Http::response(['ok' => true], 200),
    ]);

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/telegram/link');

    $response->assertOk();

    expect($response->json('data.url'))->toStartWith('https://t.me/rotless_bot?start=')
        ->and($response->json('data.bot_username'))->toBe('rotless_bot')
        ->and($response->json('data.start_command'))->toStartWith('/start ')
        ->and(TelegramLinkToken::where('user_id', $user->id)->whereNull('used_at')->count())->toBe(1);
});

it('uses the token username when the configured one does not match', function () {
    config()->set('services.telegram.bot_username', 'wrong_bot');
    Http::fake([
        'https://api.telegram.org/bottest-token/getMe' => Http::response(['ok' => true, 'result' => ['username' => 'real_bot']], 200),
        '*' => Http::response(['ok' => true], 200),
    ]);

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/telegram/link');

    $response->assertOk();

    expect($response->json('data.url'))->toStartWith('https://t.me/real_bot?start=');
});

it('resolves the bot username from the token when not configured', function () {
    config()->set('services.telegram.bot_username', '');
    Http::fake([
        'https://api.telegram.org/bottest-token/getMe' => Http::response(['ok' => true, 'result' => ['username' => 'resolved_bot']], 200),
        '*' => Http::response(['ok' => true], 200),
    ]);

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/telegram/link');

    $response->assertOk();

    expect($response->json('data.url'))->toStartWith('https://t.me/resolved_bot?start=');
});

it('links the chat id when the webhook receives the start command', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $user = User::factory()->create();
    TelegramLinkToken::create([
        'user_id' => $user->id,
        'token_hash' => hash('sha256', 'plain-link-token'),
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->postJson('/api/v1/telegram/webhook', [
        'message' => [
            'text' => '/start plain-link-token',
            'chat' => ['id' => 987654321, 'first_name' => 'Ana', 'last_name' => 'Silva'],
        ],
    ], ['X-Telegram-Bot-Api-Secret-Token' => 'webhook-secret']);

    $response->assertOk();

    expect($user->fresh()->telegram_chat_id)->toBe('987654321')
        ->and($user->fresh()->telegram_chat_name)->toBe('Ana Silva')
        ->and(TelegramLinkToken::where('user_id', $user->id)->whereNotNull('used_at')->count())->toBe(1);
});

it('rejects the webhook when the secret header is missing or wrong', function () {
    $payload = ['message' => ['text' => '/start anything', 'chat' => ['id' => 1]]];

    $this->postJson('/api/v1/telegram/webhook', $payload)->assertForbidden();
    $this->postJson('/api/v1/telegram/webhook', $payload, ['X-Telegram-Bot-Api-Secret-Token' => 'wrong'])->assertForbidden();
});

it('ignores expired or already used link tokens', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $user = User::factory()->create();
    TelegramLinkToken::create([
        'user_id' => $user->id,
        'token_hash' => hash('sha256', 'expired-token'),
        'expires_at' => now()->subMinute(),
    ]);

    $this->postJson('/api/v1/telegram/webhook', [
        'message' => ['text' => '/start expired-token', 'chat' => ['id' => 555]],
    ], ['X-Telegram-Bot-Api-Secret-Token' => 'webhook-secret'])->assertOk();

    expect($user->fresh()->telegram_chat_id)->toBeNull();
});

it('unlinks the telegram account', function () {
    $user = User::factory()->create(['telegram_chat_id' => '123', 'telegram_chat_name' => 'Ana']);

    $this->actingAs($user, 'sanctum')->deleteJson('/api/v1/telegram/link')->assertOk();

    expect($user->fresh()->telegram_chat_id)->toBeNull()
        ->and($user->fresh()->telegram_chat_name)->toBeNull();
});

it('does not let a profile update change the chat id', function () {
    $user = User::factory()->create(['telegram_chat_id' => '123']);

    $this->actingAs($user, 'sanctum')->patchJson('/api/v1/user/profile', [
        'name' => 'Renamed',
        'telegram_chat_id' => '999',
    ])->assertOk();

    expect($user->fresh()->name)->toBe('Renamed')
        ->and($user->fresh()->telegram_chat_id)->toBe('123');
});

it('registers and removes the webhook through the console command', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $this->artisan('app:telegram-webhook')->assertSuccessful();
    $this->artisan('app:telegram-webhook', ['--delete' => true])->assertSuccessful();

    Http::assertSent(fn ($request) => str_contains($request->url(), 'setWebhook')
        && $request['secret_token'] === 'webhook-secret');
    Http::assertSent(fn ($request) => str_contains($request->url(), 'deleteWebhook'));
});
