<?php

declare(strict_types=1);

namespace App\Events;

final class BatchesNearExpiry
{
    /**
     * @param  array<int>  $batchIds  IDs of active batches expiring within the warning window.
     */
    public function __construct(
        public readonly array $batchIds,
    ) {}
}
