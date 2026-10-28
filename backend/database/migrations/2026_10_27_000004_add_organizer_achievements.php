<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les succes d'un organisateur. Ils se calculent a partir des evenements, des
 * commandes et des participants, mais chaque succes obtenu est note ici : il
 * reste acquis meme si l'evenement qui l'a valu est supprime, et seen_at dit
 * si l'organisateur a deja vu la fenetre qui l'annonce.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('organizer_achievements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organizer_id')->constrained('organizers')->cascadeOnDelete();
            $table->string('achievement', 50);
            $table->timestamp('earned_at');
            $table->timestamp('seen_at')->nullable();
            $table->timestamps();

            $table->unique(['organizer_id', 'achievement']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizer_achievements');
    }
};
