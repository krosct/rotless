<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only log of everything done in a household: batch movements
     * (created, updated, consumed, discarded, deleted) and member events. A
     * batch keeps its current state; this table keeps what happened to it.
     */
    public function up(): void
    {
        Schema::create('household_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 32);
            // No foreign key: the movement of a deleted batch keeps its id.
            $table->unsignedBigInteger('batch_id')->nullable();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            // Snapshot, so renames and deletions do not rewrite history.
            $table->string('product_name')->nullable();
            $table->unsignedInteger('quantity')->nullable();
            $table->foreignId('subject_user_id')->nullable()->constrained('users')->nullOnDelete();
            // {"field": {"from": ..., "to": ...}}
            $table->json('changes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // History pages (newest first) and report windows.
            $table->index(['household_id', 'id']);
            $table->index(['household_id', 'created_at']);
            $table->index('batch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('household_movements');
    }
};
