<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\BatchStatus;
use App\Enums\HouseholdRole;
use App\Events\BatchesNearExpiry;
use App\Models\Batch;
use App\Models\Household;
use App\Models\NotificationLog;
use App\Models\Product;
use App\Models\User;
use Illuminate\Console\Command;

final class TelegramSmokeTest extends Command
{
    protected $signature = 'app:telegram-smoke';

    protected $description = 'End-to-end Telegram expiry alert check: create fixtures, send, verify and clean up.';

    private const WAIT_SECONDS = 20;

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('Refusing to run the Telegram smoke test in production.');

            return self::FAILURE;
        }

        $botToken = (string) config('services.telegram.bot_token', '');
        $chatId = (string) config('services.telegram.test_chat_id', '');

        if ($botToken === '') {
            $this->error('TELEGRAM_BOT_TOKEN is not configured.');

            return self::FAILURE;
        }

        if ($chatId === '') {
            $this->error('TELEGRAM_CHAT_ID is not configured.');

            return self::FAILURE;
        }

        $user = null;
        $household = null;
        $product = null;
        $batch = null;

        try {
            $user = User::create([
                'name' => 'Telegram Smoke Test',
                'email' => 'telegram-smoke-'.now()->getTimestamp().'@example.test',
                'password' => 'password',
                'telegram_chat_id' => $chatId,
            ]);

            $household = Household::create(['name' => 'Telegram Smoke Test']);
            $household->users()->attach($user->id, ['role' => HouseholdRole::Owner->value]);

            $product = Product::create(['name' => 'Telegram Smoke Product']);

            $batch = Batch::create([
                'household_id' => $household->id,
                'product_id' => $product->id,
                'quantity' => 1,
                'expires_at' => today()->addDays(2),
                'status' => BatchStatus::Active,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            $this->info('Fixtures created. Dispatching BatchesNearExpiry for the test batch only...');
            event(new BatchesNearExpiry([$batch->id]));

            $log = $this->awaitNotificationLog($batch->id, $user->id);

            if ($log === null) {
                $this->error('No notification_log row appeared within '.self::WAIT_SECONDS.'s. Is the queue worker running?');

                return self::FAILURE;
            }

            if ($log->status === 'sent') {
                $this->info('E2E OK: Telegram message sent and logged as sent.');

                return self::SUCCESS;
            }

            $this->error('E2E FAILED: '.($log->error_message ?? 'unknown error'));

            return self::FAILURE;
        } finally {
            $this->cleanup($batch, $product, $household, $user);
        }
    }

    private function awaitNotificationLog(int $batchId, int $userId): ?NotificationLog
    {
        for ($attempt = 0; $attempt < self::WAIT_SECONDS; $attempt++) {
            $log = NotificationLog::query()
                ->where('batch_id', $batchId)
                ->where('user_id', $userId)
                ->latest('id')
                ->first();

            if ($log !== null) {
                return $log;
            }

            sleep(1);
        }

        return null;
    }

    private function cleanup(?Batch $batch, ?Product $product, ?Household $household, ?User $user): void
    {
        if ($batch !== null) {
            NotificationLog::query()->where('batch_id', $batch->id)->delete();
            $batch->delete();
        }

        if ($product !== null) {
            $product->delete();
        }

        if ($household !== null) {
            $household->users()->detach();
            $household->delete();
        }

        if ($user !== null) {
            $user->delete();
        }

        $this->info('Fixtures cleaned up.');
    }
}
