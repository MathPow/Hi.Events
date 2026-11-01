<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chaque appel de l'assistant a Anthropic, avec ses jetons et ce qu'il a
 * coute, pour savoir dans l'administration ce que chaque compte et chaque
 * personne coute a la plateforme.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('assistant_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('model', 100);
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('cache_creation_input_tokens')->default(0);
            $table->unsignedInteger('cache_read_input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->decimal('cost_usd', 12, 6)->default(0);
            $table->string('stop_reason', 50)->nullable();
            $table->timestamps();

            $table->index(['account_id', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_usages');
    }
};
