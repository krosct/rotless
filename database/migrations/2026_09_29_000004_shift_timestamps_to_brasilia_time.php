<?php

declare(strict_types=1);

use App\Support\TimestampShift;
use Illuminate\Database\Migrations\Migration;

/**
 * One-off data migration: the app moved from UTC to America/Sao_Paulo. Rows
 * written while it ran on UTC are three hours ahead of the local wall clock the
 * app now reads them with, so shift every stored timestamp back by 3 hours.
 *
 * Additive and data-preserving: no column is dropped and `down()` shifts the
 * values back. It is a no-op on a fresh database (no rows to shift).
 */
return new class extends Migration
{
    public function up(): void
    {
        TimestampShift::run(-3);
    }

    public function down(): void
    {
        TimestampShift::run(3);
    }
};
