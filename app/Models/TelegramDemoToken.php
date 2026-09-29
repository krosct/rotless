<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class TelegramDemoToken extends Model
{
    protected $fillable = ['token_hash', 'expires_at', 'used_at', 'chat_name'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }
}
