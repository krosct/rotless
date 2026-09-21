<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Household;
use App\Models\User;

final class HouseholdPolicy
{
    public function view(User $user, Household $household): bool
    {
        return $household->roleOf($user) !== null;
    }

    /** Owner and manager may invite members and view activities. */
    public function manageMembers(User $user, Household $household): bool
    {
        return $household->roleOf($user)?->canManageMembers() ?? false;
    }

    /** Only the owner may remove members or change their roles. */
    public function removeMembers(User $user, Household $household): bool
    {
        return $household->roleOf($user)?->canRemoveMembers() ?? false;
    }
}
