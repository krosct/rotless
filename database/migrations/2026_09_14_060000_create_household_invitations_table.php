<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('household_invitations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('token', 64)->unique();
            $table->string('status', 20)->default('pending')->index();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['household_id', 'email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('household_invitations');
    }
};
