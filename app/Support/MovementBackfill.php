<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\BatchStatus;
use App\Enums\MovementAction;
use Illuminate\Support\Facades\DB;

/**
 * Rebuilds the movements of batches that existed before household_movements,
 * from what the batches still tell: who created them and when, and who
 * consumed or discarded them. Earlier edits and deletions were never stored,
 * so they cannot come back. Inserts only; never changes a batch.
 */
final class MovementBackfill
{
    public static function run(): void
    {
        DB::table('batches')
            ->join('products', 'products.id', '=', 'batches.product_id')
            ->select([
                'batches.id', 'batches.household_id', 'batches.product_id', 'products.name as product_name',
                'batches.quantity', 'batches.expires_at', 'batches.status', 'batches.created_by',
                'batches.updated_by', 'batches.created_at', 'batches.updated_at',
            ])
            ->orderBy('batches.id')
            ->chunk(500, function ($batches): void {
                $rows = [];
                foreach ($batches as $batch) {
                    $expiresAt = substr((string) $batch->expires_at, 0, 10);
                    $base = [
                        'household_id' => $batch->household_id,
                        'batch_id' => $batch->id,
                        'product_id' => $batch->product_id,
                        'product_name' => $batch->product_name,
                        'quantity' => $batch->quantity,
                        'subject_user_id' => null,
                    ];

                    $rows[] = $base + [
                        'user_id' => $batch->created_by,
                        'action' => MovementAction::Created->value,
                        'changes' => json_encode([
                            'backfilled' => true,
                            'quantity' => ['from' => null, 'to' => $batch->quantity],
                            'expires_at' => ['from' => null, 'to' => $expiresAt],
                        ]),
                        'created_at' => $batch->created_at ?? now(),
                    ];

                    if ($batch->status !== BatchStatus::Active->value) {
                        $rows[] = $base + [
                            'user_id' => $batch->updated_by,
                            'action' => $batch->status === BatchStatus::Consumed->value
                                ? MovementAction::Consumed->value
                                : MovementAction::Discarded->value,
                            'changes' => json_encode([
                                'backfilled' => true,
                                'status' => ['from' => BatchStatus::Active->value, 'to' => $batch->status],
                            ]),
                            'created_at' => $batch->updated_at ?? $batch->created_at ?? now(),
                        ];
                    }
                }

                DB::table('household_movements')->insert($rows);
            });
    }
}
