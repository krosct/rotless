<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Batch;
use App\Models\User;

final class BatchPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Batch $batch): bool
    {
        return $batch->household->users()->whereKey($user->id)->exists();
    }

    public function update(User $user, Batch $batch): bool
    {
        return $batch->household->users()->whereKey($user->id)->exists();
    }

    public function delete(User $user, Batch $batch): bool
    {
        return $batch->household->users()->whereKey($user->id)->exists();
    }
}
