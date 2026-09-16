<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\BatchesNearExpiry;
use App\Jobs\SendTelegramExpiryAlert;
use App\Models\Batch;

final class DispatchExpiryAlerts
{
    public function handle(BatchesNearExpiry $event): void
    {
        if ($event->batchIds === []) {
            return;
        }

        $batches = Batch::query()
            ->whereKey($event->batchIds)
            ->with('household.users')
            ->get();

        foreach ($batches as $batch) {
            foreach ($batch->household->users as $user) {
                $chatId = $user->telegram_chat_id;

                if (! is_string($chatId) || $chatId === '') {
                    continue;
                }

                SendTelegramExpiryAlert::dispatch((int) $batch->id, (int) $user->id);
            }
        }
    }
}
