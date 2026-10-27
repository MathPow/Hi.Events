<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La decharge de responsabilite des evenements de plein air : l'organisateur
 * en ecrit le texte, chaque participant l'accepte au paiement en tapant son
 * nom (un parent ou tuteur pour un mineur). Chaque version du texte signee est
 * gardee telle quelle : l'organisateur peut le modifier sans que les
 * signatures deja recueillies changent de sens.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->text('waiver_text')->nullable();
        });

        Schema::create('waivers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->text('text');
            $table->string('text_hash', 64);
            $table->timestamps();

            $table->unique(['event_id', 'text_hash']);
        });

        Schema::table('attendees', function (Blueprint $table) {
            $table->foreignId('waiver_id')->nullable()->constrained('waivers')->nullOnDelete();
            $table->string('waiver_signed_name', 100)->nullable();
            $table->string('waiver_guardian_name', 100)->nullable();
            $table->timestamp('waiver_signed_at')->nullable();
            $table->string('waiver_ip_address', 45)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('attendees', function (Blueprint $table) {
            $table->dropConstrainedForeignId('waiver_id');
            $table->dropColumn(['waiver_signed_name', 'waiver_guardian_name', 'waiver_signed_at', 'waiver_ip_address']);
        });

        Schema::dropIfExists('waivers');

        Schema::table('event_settings', function (Blueprint $table) {
            $table->dropColumn('waiver_text');
        });
    }
};
