<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

final class TelegramClient
{
    public function __construct(
        private readonly string $botToken,
        private readonly int $timeoutSeconds = 10,
    ) {}

    public function sendMessage(string $chatId, string $text): void
    {
        if ($this->botToken === '') {
            throw new RuntimeException('Telegram bot token is not configured.');
        }

        $response = Http::timeout($this->timeoutSeconds)
            ->post("https://api.telegram.org/bot{$this->botToken}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $text,
            ]);

        if (! $response->successful()) {
            throw new RuntimeException("Telegram API error: {$response->status()}");
        }
    }

    public static function fromConfig(): self
    {
        return new self(
            botToken: (string) config('services.telegram.bot_token', ''),
            timeoutSeconds: (int) config('services.telegram.timeout', 10),
        );
    }
}
