<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Events\BatchesNearExpiry;
use App\Models\Batch;
use Illuminate\Console\Command;

final class CheckExpiringBatches extends Command
{
    protected $signature = 'app:check-expiring-batches';

    protected $description = 'Dispatch expiry alerts for active batches within the warning window.';

    public function handle(): int
    {
        $days = (int) config('services.telegram.expiry_warning_days', 3);

        $batchIds = Batch::query()
            ->active()
            ->expiringWithin($days)
            ->pluck('id')
            ->all();

        if ($batchIds === []) {
            $this->info('No batches expiring within the warning window.');

            return self::SUCCESS;
        }

        event(new BatchesNearExpiry($batchIds));

        $this->info('Dispatched expiry alerts for '.count($batchIds).' batches.');

        return self::SUCCESS;
    }
}
