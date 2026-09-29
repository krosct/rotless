<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Shifts every stored wall-clock timestamp by N hours. The app used to run on
 * UTC and now runs on America/Sao_Paulo, so rows written before the switch read
 * three hours ahead on the app clock; the one-off migration subtracts 3 hours
 * (and adds them back on rollback).
 *
 * Date-only columns (batches.expires_at) are left alone. Transient infra tables
 * (sessions, cache, jobs, password_reset_tokens) are intentionally kept out:
 * their rows are short-lived and shifting them could corrupt scheduling.
 */
final class TimestampShift
{
    /** @var array<string, list<string>> */
    private const COLUMNS = [
        'users' => ['email_verified_at', 'created_at', 'updated_at'],
        'households' => ['created_at', 'updated_at'],
        'household_user' => ['created_at', 'updated_at'],
        'products' => ['created_at', 'updated_at'],
        'batches' => ['created_at', 'updated_at'],
        'notification_log' => ['sent_at', 'created_at', 'updated_at'],
        'household_invitations' => ['expires_at', 'created_at', 'updated_at'],
        'household_movements' => ['created_at'],
        'telegram_link_tokens' => ['expires_at', 'used_at', 'created_at', 'updated_at'],
        'telegram_demo_tokens' => ['expires_at', 'used_at', 'created_at', 'updated_at'],
        'personal_access_tokens' => ['last_used_at', 'expires_at', 'created_at', 'updated_at'],
    ];

    public static function run(int $hours): void
    {
        foreach (self::COLUMNS as $table => $columns) {
            foreach ($columns as $column) {
                self::shiftColumn($table, $column, $hours);
            }
        }
    }

    private static function shiftColumn(string $table, string $column, int $hours): void
    {
        $expression = match (DB::connection()->getDriverName()) {
            'sqlite' => "datetime({$column}, '".sprintf('%+d hours', $hours)."')",
            'mysql', 'mariadb' => "date_add({$column}, interval {$hours} hour)",
            'pgsql' => "{$column} + interval '{$hours} hours'",
            default => throw new RuntimeException('TimestampShift does not support this database driver.'),
        };

        DB::table($table)->whereNotNull($column)->update([$column => DB::raw($expression)]);
    }
}
