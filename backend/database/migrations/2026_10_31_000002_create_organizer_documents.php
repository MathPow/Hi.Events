<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les documents d'un organisateur (attestations, decharges, formulaires) : des
 * blocs (titre, clause, champ a remplir, signature...) gardes en JSON, lies a
 * un ou plusieurs evenements. Chaque participant d'un evenement lie en recoit
 * une copie a son nom : signee en ligne au paiement ou a imprimer, gardee telle
 * qu'elle etait ce jour-la meme si l'organisateur change le document ensuite.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('organizer_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organizer_id')->constrained('organizers')->cascadeOnDelete();
            $table->string('title', 150);
            $table->jsonb('blocks');
            // ONLINE: signe au paiement, PDF signe envoye par courriel; PRINT: PDF joint au billet.
            $table->string('signing_mode', 20)->default('ONLINE');
            // ALL: chaque participant; MINORS: seulement les moins de 18 ans le jour de l'evenement.
            $table->string('audience', 20)->default('ALL');
            $table->string('template', 40)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('organizer_id');
        });

        Schema::create('event_organizer_document', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organizer_document_id')->constrained('organizer_documents')->cascadeOnDelete();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['organizer_document_id', 'event_id']);
            $table->index('event_id');
        });

        Schema::create('document_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organizer_document_id')->nullable()->constrained('organizer_documents')->nullOnDelete();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('attendee_id')->constrained('attendees')->cascadeOnDelete();
            // Le document tel qu'il etait au paiement.
            $table->string('title', 150);
            $table->jsonb('blocks');
            $table->string('signing_mode', 20);
            $table->string('audience', 20);
            // Les reponses du participant (champs, cases, signatures) et les champs automatiques.
            $table->jsonb('answers')->nullable();
            $table->jsonb('auto_values')->nullable();
            $table->string('signer_name', 100)->nullable();
            $table->string('guardian_name', 100)->nullable();
            $table->timestamp('signed_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index('attendee_id');
            $table->index('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_signatures');
        Schema::dropIfExists('event_organizer_document');
        Schema::dropIfExists('organizer_documents');
    }
};
