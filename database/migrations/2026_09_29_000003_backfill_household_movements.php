<?php

declare(strict_types=1);

use App\Support\MovementBackfill;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /** History for the batches that existed before household_movements (insert-only). */
    public function up(): void
    {
        MovementBackfill::run();
    }

    public function down(): void
    {
        // The rows go away with the table (previous migration's down).
    }
};
