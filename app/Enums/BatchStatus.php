<?php

declare(strict_types=1);

namespace App\Enums;

enum BatchStatus: string
{
    case Active = 'active';
    case Consumed = 'consumed';
    case Discarded = 'discarded';
}
