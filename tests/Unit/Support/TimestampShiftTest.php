<?php

declare(strict_types=1);

use App\Support\TimestampShift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

function insertUserAt(string $createdAt): void
{
    DB::table('users')->insert([
        'name' => 'Ana',
        'email' => uniqid('ana-').'@example.test',
        'password' => 'x',
        'created_at' => $createdAt,
        'updated_at' => $createdAt,
    ]);
}

it('shifts every stored timestamp back by three hours', function () {
    insertUserAt('2026-09-01 12:00:00');

    TimestampShift::run(-3);

    expect(DB::table('users')->value('created_at'))->toBe('2026-09-01 09:00:00')
        ->and(DB::table('users')->value('updated_at'))->toBe('2026-09-01 09:00:00');
});

it('shifts the timestamps forward again on rollback', function () {
    insertUserAt('2026-09-01 09:00:00');

    TimestampShift::run(3);

    expect(DB::table('users')->value('created_at'))->toBe('2026-09-01 12:00:00');
});
