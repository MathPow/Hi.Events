<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La fiche participant des evenements sportifs : des questions toutes faites
 * (date de naissance, contact d'urgence, sante) que l'organisateur ajoute d'un
 * clic. preset_key les reconnait (l'age du participant pour la decharge) ;
 * is_sensitive fait effacer les reponses apres l'evenement (loi 25).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->string('preset_key', 40)->nullable();
            $table->boolean('is_sensitive')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn(['preset_key', 'is_sensitive']);
        });
    }
};
