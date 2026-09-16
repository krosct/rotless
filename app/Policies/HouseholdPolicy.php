<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\HouseholdRole;
use App\Models\Household;
use App\Models\User;

final class HouseholdPolicy
{
    public function view(User $user, Household $household): bool
    {
        return $this->isMember($user, $household);
    }

    public function manageMembers(User $user, Household $household): bool
    {
        return $household->users()
            ->whereKey($user->id)
            ->wherePivot('role', HouseholdRole::Owner->value)
            ->exists();
    }

    private function isMember(User $user, Household $household): bool
    {
        return $household->users()->whereKey($user->id)->exists();
    }
}
