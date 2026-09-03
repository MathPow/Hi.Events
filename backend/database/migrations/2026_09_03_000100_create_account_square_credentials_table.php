<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Equivalent Square de account_stripe_platforms.
 *
 * Square ne connait pas la notion de "plateforme regionale" comme Stripe: un
 * marchand autorise l'application via OAuth et on recoit un jeton d'acces qui
 * vaut pour son compte. On stocke donc un jeu de jetons par compte HiEvents,
 * separe par environnement pour qu'un compte puisse etre branche en sandbox
 * pendant les tests sans ecraser sa connexion de production.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('account_square_credentials', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('account_id');
            $table->string('environment', 16)->default('production');
            $table->string('merchant_id')->nullable();
            // Chiffres au repos via le cast 'encrypted' du modele: un jeton Square
            // permet d'encaisser au nom du marchand, une fuite de la base suffirait
            // sinon a vider son compte.
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->string('location_id')->nullable();
            $table->string('currency', 3)->nullable();
            $table->string('country', 2)->nullable();
            $table->jsonb('scopes')->nullable();
            $table->jsonb('merchant_details')->nullable();
            $table->timestamp('setup_completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('account_id')->references('id')->on('accounts')->onDelete('cascade');
            $table->index(['account_id', 'environment']);
            $table->index('merchant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_square_credentials');
    }
};
