<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BatchStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class Batch extends Model
{
    protected $fillable = ['household_id', 'product_id', 'quantity', 'expires_at', 'status', 'created_by', 'updated_by'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'date',
            'status' => BatchStatus::class,
        ];
    }

    /** @return BelongsTo<Household, $this> */
    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', BatchStatus::Active);
    }

    public function scopeExpiringWithin(Builder $query, int $days): Builder
    {
        return $query->whereDate('expires_at', '>=', today())
            ->whereDate('expires_at', '<=', today()->addDays($days));
    }
}
