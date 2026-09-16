<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->date('expires_at');
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();

            $table->index(['household_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
