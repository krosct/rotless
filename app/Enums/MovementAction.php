<?php

declare(strict_types=1);

namespace App\Enums;

/** What a row of household_movements records. */
enum MovementAction: string
{
    case Created = 'created';
    case Updated = 'updated';
    case Consumed = 'consumed';
    case Discarded = 'discarded';
    case Deleted = 'deleted';
    case ProductUpdated = 'product_updated';
    case HouseholdRenamed = 'household_renamed';
    case MemberInvited = 'member_invited';
    case MemberJoined = 'member_joined';
    case MemberRemoved = 'member_removed';
    case MemberRoleChanged = 'member_role_changed';

    /** @return list<string> */
    public static function memberActions(): array
    {
        return [
            self::HouseholdRenamed->value,
            self::MemberInvited->value,
            self::MemberJoined->value,
            self::MemberRemoved->value,
            self::MemberRoleChanged->value,
        ];
    }
}
