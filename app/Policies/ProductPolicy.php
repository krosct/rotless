<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

final class ProductPolicy
{
    public function update(User $user, Product $product): bool
    {
        return $product->batches()
            ->whereHas('household', fn ($query) => $query->whereHas('users', fn ($users) => $users->whereKey($user->id)))
            ->exists();
    }
}
