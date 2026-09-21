<?php

declare(strict_types=1);

namespace App\Enums;

enum HouseholdRole: string
{
    case Owner = 'owner';
    case Manager = 'manager';
    case Member = 'member';

    /** Roles allowed to invite members and view household activities. */
    public function canManageMembers(): bool
    {
        return $this === self::Owner || $this === self::Manager;
    }

    /** Only the owner may remove members or change their roles. */
    public function canRemoveMembers(): bool
    {
        return $this === self::Owner;
    }
}
