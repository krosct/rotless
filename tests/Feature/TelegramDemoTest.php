<?php

declare(strict_types=1);

use App\Models\TelegramDemoToken;
use App\Models\TelegramLinkToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config()->set('services.telegram.bot_token', 'test-token');
    config()->set('services.telegram.bot_username', 'rotless_bot');
    config()->set('services.telegram.webhook_secret', 'webhook-secret');
});

function sendStart(string $token, int $chatId = 424242): void
{
    test()->postJson('/api/v1/telegram/webhook', [
        'message' => [
            'text' => "/start {$token}",
            'chat' => ['id' => $chatId, 'first_name' => 'Visitante'],
        ],
    ], ['X-Telegram-Bot-Api-Secret-Token' => 'webhook-secret'])->assertOk();
}

it('returns a demo deep link without authentication', function () {
    Http::fake([
        'https://api.telegram.org/bottest-token/getMe' => Http::response(['ok' => true, 'result' => ['username' => 'rotless_bot']], 200),
        '*' => Http::response(['ok' => true], 200),
    ]);

    $response = $this->postJson('/api/v1/telegram/demo-link');

    $response->assertOk();

    expect($response->json('data.url'))->toStartWith('https://t.me/rotless_bot?start=')
        ->and($response->json('data.start_command'))->toStartWith('/start ')
        ->and(TelegramDemoToken::whereNull('used_at')->count())->toBe(1)
        ->and(TelegramLinkToken::count())->toBe(0);
});

it('answers a demo token with a sample message and links no account', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $user = User::factory()->create();
    TelegramDemoToken::create([
        'token_hash' => hash('sha256', 'demo-token'),
        'expires_at' => now()->addMinute(),
    ]);

    sendStart('demo-token');

    Http::assertSent(fn (Request $request): bool => str_ends_with($request->url(), '/sendMessage')
        && $request['chat_id'] === '424242'
        && str_contains((string) $request['text'], 'mensagem de demonstração'));

    expect(User::whereNotNull('telegram_chat_id')->count())->toBe(0)
        ->and($user->fresh()->telegram_chat_id)->toBeNull()
        ->and(TelegramDemoToken::first()->used_at)->not->toBeNull()
        ->and(TelegramDemoToken::first()->chat_name)->toBe('Visitante');
});

it('reports the demo token status to the demo mode', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    TelegramDemoToken::create([
        'token_hash' => hash('sha256', 'demo-token'),
        'expires_at' => now()->addMinute(),
    ]);

    $this->getJson('/api/v1/telegram/demo-link/demo-token')
        ->assertOk()
        ->assertJsonPath('data.linked', false);

    sendStart('demo-token');

    $this->getJson('/api/v1/telegram/demo-link/demo-token')
        ->assertOk()
        ->assertJsonPath('data.linked', true)
        ->assertJsonPath('data.chat_name', 'Visitante');

    $this->getJson('/api/v1/telegram/demo-link/unknown')->assertNotFound();
});

it('ignores an expired demo token', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    TelegramDemoToken::create([
        'token_hash' => hash('sha256', 'old-demo-token'),
        'expires_at' => now()->subMinute(),
    ]);

    sendStart('old-demo-token');

    Http::assertSent(fn (Request $request): bool => str_contains((string) $request['text'], 'invalid or has expired'));
    expect(TelegramDemoToken::first()->used_at)->toBeNull();
});

it('prunes demo tokens older than a day', function () {
    Http::fake([
        'https://api.telegram.org/bottest-token/getMe' => Http::response(['ok' => true, 'result' => ['username' => 'rotless_bot']], 200),
    ]);

    $old = TelegramDemoToken::create([
        'token_hash' => hash('sha256', 'stale'),
        'expires_at' => now()->subDays(2),
    ]);
    $old->forceFill(['created_at' => now()->subDays(2)])->save();

    $this->postJson('/api/v1/telegram/demo-link')->assertOk();

    expect(TelegramDemoToken::count())->toBe(1)
        ->and(TelegramDemoToken::find($old->id))->toBeNull();
});
