<?php

declare(strict_types=1);

namespace App\Enums;

enum HouseholdRole: string
{
    case Owner = 'owner';
    case Member = 'member';
}
