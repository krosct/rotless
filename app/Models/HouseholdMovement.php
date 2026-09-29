<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MovementAction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class HouseholdMovement extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'household_id', 'user_id', 'action', 'batch_id', 'product_id', 'product_name',
        'quantity', 'subject_user_id', 'changes', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'action' => MovementAction::class,
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Records a movement of a batch. $changes maps a field to [from, to].
     *
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    public static function forBatch(Batch $batch, MovementAction $action, ?User $user, ?int $quantity = null, array $changes = []): self
    {
        return self::create([
            'household_id' => $batch->household_id,
            'user_id' => $user?->id,
            'action' => $action,
            'batch_id' => $batch->id,
            'product_id' => $batch->product_id,
            'product_name' => $batch->product->name,
            'quantity' => $quantity,
            'changes' => self::formatChanges($changes),
        ]);
    }

    /**
     * Records a household event (members, name).
     *
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    public static function forHousehold(Household $household, MovementAction $action, ?User $user, ?User $subject = null, array $changes = []): self
    {
        return self::create([
            'household_id' => $household->id,
            'user_id' => $user?->id,
            'action' => $action,
            'subject_user_id' => $subject?->id,
            'changes' => self::formatChanges($changes),
        ]);
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     * @return array<string, array{from: mixed, to: mixed}>|null
     */
    private static function formatChanges(array $changes): ?array
    {
        $formatted = [];
        foreach ($changes as $field => [$from, $to]) {
            if ($from !== $to) {
                $formatted[$field] = ['from' => $from, 'to' => $to];
            }
        }

        return $formatted === [] ? null : $formatted;
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }
}
