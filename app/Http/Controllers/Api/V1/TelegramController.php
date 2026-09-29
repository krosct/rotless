<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\TelegramWebhookRequest;
use App\Models\TelegramDemoToken;
use App\Models\TelegramLinkToken;
use App\Services\TelegramClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

final class TelegramController extends Controller
{
    private const LINK_TTL_MINUTES = 1;

    public function link(Request $request): JsonResponse
    {
        $user = $request->user();

        try {
            $username = $this->resolveBotUsername();
        } catch (Throwable) {
            return response()->json([
                'message' => 'Telegram bot is not reachable. Check TELEGRAM_BOT_TOKEN.',
            ], 503);
        }

        TelegramLinkToken::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $plain = Str::random(48);

        $token = TelegramLinkToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addMinutes(self::LINK_TTL_MINUTES),
        ]);

        return response()->json([
            'data' => [
                'url' => "https://t.me/{$username}?start={$plain}",
                'bot_username' => $username,
                'start_command' => "/start {$plain}",
                'expires_at' => $token->expires_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * Link token for the demo mode (no account): the bot answers it with a
     * sample alert and links nothing. Same shape as link().
     */
    public function demoLink(): JsonResponse
    {
        try {
            $username = $this->resolveBotUsername();
        } catch (Throwable) {
            return response()->json([
                'message' => 'Telegram bot is not reachable. Check TELEGRAM_BOT_TOKEN.',
            ], 503);
        }

        // Demo tokens are throwaway: keep the table small.
        TelegramDemoToken::query()->where('created_at', '<', now()->subDay())->delete();

        $plain = Str::random(48);

        $token = TelegramDemoToken::create([
            'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addMinutes(self::LINK_TTL_MINUTES),
        ]);

        return response()->json([
            'data' => [
                'url' => "https://t.me/{$username}?start={$plain}",
                'bot_username' => $username,
                'start_command' => "/start {$plain}",
                'expires_at' => $token->expires_at->toIso8601String(),
            ],
        ]);
    }

    /** Lets the demo mode see when the bot answered its token. */
    public function demoLinkStatus(string $token): JsonResponse
    {
        $record = TelegramDemoToken::query()->where('token_hash', hash('sha256', $token))->first();

        if ($record === null) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        return response()->json([
            'data' => [
                'linked' => $record->used_at !== null,
                'chat_name' => $record->chat_name,
            ],
        ]);
    }

    private function resolveBotUsername(): string
    {
        $configured = (string) config('services.telegram.bot_username', '');
        $fromToken = TelegramClient::fromConfig()->botUsername();

        if ($configured !== '' && $configured !== $fromToken) {
            report(new RuntimeException(
                "TELEGRAM_BOT_USERNAME ({$configured}) does not match the bot token ({$fromToken})."
            ));
        }

        return $fromToken;
    }

    public function unlink(Request $request): JsonResponse
    {
        $request->user()->update([
            'telegram_chat_id' => null,
            'telegram_chat_name' => null,
        ]);

        return response()->json(['message' => 'Telegram account unlinked.']);
    }

    public function webhook(TelegramWebhookRequest $request): JsonResponse
    {
        $text = $request->input('message.text');
        $chatId = $request->input('message.chat.id');

        if (is_string($text) && is_scalar($chatId)) {
            $this->handleStartCommand($text, (string) $chatId, $this->resolveChatName($request));
        }

        return response()->json(['ok' => true]);
    }

    private function resolveChatName(TelegramWebhookRequest $request): ?string
    {
        $title = $request->input('message.chat.title');

        if (is_string($title) && $title !== '') {
            return $title;
        }

        $parts = array_filter([
            $request->input('message.chat.first_name'),
            $request->input('message.chat.last_name'),
        ], static fn ($value): bool => is_string($value) && $value !== '');

        if ($parts !== []) {
            return implode(' ', $parts);
        }

        $username = $request->input('message.chat.username');

        return is_string($username) && $username !== '' ? '@'.$username : null;
    }

    private function handleStartCommand(string $text, string $chatId, ?string $chatName): void
    {
        if (! str_starts_with($text, '/start')) {
            return;
        }

        $token = trim(substr($text, strlen('/start')));

        if ($token === '') {
            $this->reply($chatId, 'Open the linking link from the rotless app to connect your account.');

            return;
        }

        $record = TelegramLinkToken::query()
            ->where('token_hash', hash('sha256', $token))
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($record === null) {
            if ($this->answerDemoToken($token, $chatId, $chatName)) {
                return;
            }

            $this->reply($chatId, 'This linking link is invalid or has expired. Generate a new one in the rotless app.');

            return;
        }

        $record->user?->update([
            'telegram_chat_id' => $chatId,
            'telegram_chat_name' => $chatName,
        ]);
        $record->update(['used_at' => now()]);

        $this->reply($chatId, 'Your rotless account is now linked. You will receive expiry alerts here.');
    }

    /** Answers a demo token with a sample alert; links no account. */
    private function answerDemoToken(string $token, string $chatId, ?string $chatName): bool
    {
        $record = TelegramDemoToken::query()
            ->where('token_hash', hash('sha256', $token))
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($record === null) {
            return false;
        }

        $record->update(['used_at' => now(), 'chat_name' => $chatName]);

        $this->reply($chatId, implode("\n", [
            '🔔 rotless — mensagem de demonstração',
            '',
            'É assim que os avisos de validade chegam aqui:',
            '• Leite integral (2 un) vence amanhã',
            '• Iogurte natural vence em 2 dias',
            '• Peito de frango venceu ontem',
            '',
            'Esta é uma conta de teste: nenhuma conta foi vinculada e você não receberá outros avisos.',
            'Crie sua conta no rotless para receber os alertas da sua despensa.',
        ]));

        return true;
    }

    private function reply(string $chatId, string $message): void
    {
        try {
            TelegramClient::fromConfig()->sendMessage($chatId, $message);
        } catch (Throwable) {
            // Never fail the webhook because a courtesy reply could not be delivered.
        }
    }
}
