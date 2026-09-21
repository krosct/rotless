<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Product extends Model
{
    protected $fillable = ['name', 'barcode', 'photo_path', 'openfoodfacts_data'];

    protected function casts(): array
    {
        return [
            'openfoodfacts_data' => 'array',
        ];
    }

    /** @return HasMany<Batch, $this> */
    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }
}
