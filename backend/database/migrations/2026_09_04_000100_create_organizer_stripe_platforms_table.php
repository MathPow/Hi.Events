<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Connexion Stripe propre a un organisateur, calquee sur account_stripe_platforms.
 *
 * Jusqu'ici Stripe etait attache au compte: tous les evenements encaissaient sur
 * le meme marchand, quel que soit l'organisateur. Un organisateur client doit
 * recevoir son argent directement, sans transiter par le compte de la
 * billetterie.
 *
 * Table dediee plutot qu'une colonne sur organizer_settings: la connexion porte
 * un etat (plateforme d'origine, fin d'onboarding, details renvoyes par Stripe)
 * qui doit vivre et expirer avec elle, pas avec les reglages d'affichage.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('organizer_stripe_platforms', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('organizer_id');
            $table->string('stripe_connect_account_type')->nullable();
            // La plateforme qui a cree le compte connecte: encaisser avec les cles
            // d'une autre plateforme que celle d'origine echoue chez Stripe.
            $table->string('stripe_connect_platform', 2)->nullable();
            $table->string('stripe_account_id')->nullable()->unique();
            $table->timestamp('stripe_setup_completed_at')->nullable();
            $table->jsonb('stripe_account_details')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organizer_id')->references('id')->on('organizers')->onDelete('cascade');
            $table->index(['organizer_id', 'stripe_connect_platform']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizer_stripe_platforms');
    }
};
