<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Link tokens of the demo mode (login screen shortcut): the bot answers them
     * with a sample message and links no account, so they have no user.
     */
    public function up(): void
    {
        Schema::create('telegram_demo_tokens', function (Blueprint $table): void {
            $table->id();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->string('chat_name')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telegram_demo_tokens');
    }
};
