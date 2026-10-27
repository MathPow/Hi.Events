<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Les dossards des courses : l'organisateur donne un premier numero par option
 * de billet (une distance), et chaque participant recoit le suivant quand sa
 * commande est confirmee. Un numero n'est donne qu'une fois par evenement.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_prices', function (Blueprint $table) {
            $table->unsignedInteger('bib_number_start')->nullable();
        });

        Schema::table('attendees', function (Blueprint $table) {
            $table->unsignedInteger('bib_number')->nullable();
        });

        DB::statement('CREATE UNIQUE INDEX attendees_event_bib_number_unique ON attendees (event_id, bib_number) WHERE bib_number IS NOT NULL AND deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS attendees_event_bib_number_unique');

        Schema::table('attendees', function (Blueprint $table) {
            $table->dropColumn('bib_number');
        });

        Schema::table('product_prices', function (Blueprint $table) {
            $table->dropColumn('bib_number_start');
        });
    }
};
