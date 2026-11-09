<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chaque participant signe lui-meme la decharge et les documents en ligne : l'acheteur ne signe
 * que pour son propre billet, les autres recoivent un lien par courriel (ou signent a l'entree).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->boolean('participants_sign_themselves')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->dropColumn('participants_sign_themselves');
        });
    }
};
