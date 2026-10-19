<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marque les comptes crees par l'inscription publique, pour les compter:
 * APP_PUBLIC_SIGNUP_LIMIT ferme l'inscription une fois ce nombre atteint, au
 * cas ou des robots passeraient Turnstile. Les comptes existants ont ete
 * crees sur invitation et ne comptent pas.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->boolean('is_public_signup')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('is_public_signup');
        });
    }
};
