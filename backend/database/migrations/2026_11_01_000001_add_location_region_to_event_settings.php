<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La region du lieu d'un evenement (au Quebec, sa region administrative: « Estrie »), trouvee avec
 * ses coordonnees. Le succes « Tour du Québec » compte les regions ou l'organisateur a tenu des evenements.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->string('location_region', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->dropColumn('location_region');
        });
    }
};
