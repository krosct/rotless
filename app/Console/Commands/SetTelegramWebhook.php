<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

final class SetTelegramWebhook extends Command
{
    protected $signature = 'app:telegram-webhook {--delete : Remove the webhook instead of registering it}';

    protected $description = 'Register or remove the Telegram webhook that receives account-linking commands.';

    public function handle(): int
    {
        $token = (string) config('services.telegram.bot_token', '');

        if ($token === '') {
            $this->error('TELEGRAM_BOT_TOKEN is not configured.');

            return self::FAILURE;
        }

        if ($this->option('delete')) {
            return $this->deleteWebhook($token);
        }

        return $this->setWebhook($token);
    }

    private function setWebhook(string $token): int
    {
        $secret = (string) config('services.telegram.webhook_secret', '');

        if ($secret === '') {
            $this->error('TELEGRAM_WEBHOOK_SECRET is not configured.');

            return self::FAILURE;
        }

        $url = rtrim((string) config('app.url'), '/').'/api/v1/telegram/webhook';

        $response = Http::post("https://api.telegram.org/bot{$token}/setWebhook", [
            'url' => $url,
            'secret_token' => $secret,
            'allowed_updates' => ['message'],
        ]);

        if (! $response->successful()) {
            $this->error("Telegram API error: {$response->status()}");

            return self::FAILURE;
        }

        $this->info("Webhook registered at {$url}.");

        return self::SUCCESS;
    }

    private function deleteWebhook(string $token): int
    {
        $response = Http::post("https://api.telegram.org/bot{$token}/deleteWebhook");

        if (! $response->successful()) {
            $this->error("Telegram API error: {$response->status()}");

            return self::FAILURE;
        }

        $this->info('Webhook removed.');

        return self::SUCCESS;
    }
}
