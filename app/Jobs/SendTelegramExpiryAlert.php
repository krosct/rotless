<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\BatchStatus;
use App\Models\Batch;
use App\Models\NotificationLog;
use App\Models\User;
use App\Services\TelegramClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

final class SendTelegramExpiryAlert implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $batchId,
        public readonly int $userId,
    ) {}

    public function handle(): void
    {
        $batch = Batch::query()->with(['household', 'product'])->find($this->batchId);
        $user = User::query()->find($this->userId);

        if ($batch === null || $user === null) {
            return;
        }

        if ($batch->status !== BatchStatus::Active) {
            return;
        }

        $chatId = $user->telegram_chat_id;

        if (! is_string($chatId) || $chatId === '') {
            return;
        }

        $text = "Reminder: {$batch->product->name} expires on {$batch->expires_at->toDateString()}.";

        try {
            TelegramClient::fromConfig()->sendMessage($chatId, $text);
        } catch (Throwable $exception) {
            NotificationLog::create([
                'household_id' => $batch->household_id,
                'user_id' => $user->id,
                'batch_id' => $batch->id,
                'channel' => 'telegram',
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
            ]);

            return;
        }

        NotificationLog::create([
            'household_id' => $batch->household_id,
            'user_id' => $user->id,
            'batch_id' => $batch->id,
            'channel' => 'telegram',
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }
}
