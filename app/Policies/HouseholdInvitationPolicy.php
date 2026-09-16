<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\HouseholdInvitation;
use App\Models\User;

final class HouseholdInvitationPolicy
{
    public function accept(User $user, HouseholdInvitation $invitation): bool
    {
        return $invitation->isUsable()
            && $user->email === $invitation->email;
    }
}
