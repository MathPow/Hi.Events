<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A document « selon l'âge » (audience MINORS) is for the participants under this age on the event's
 * day: 16 for the rules some activities have in Québec. Empty, it stays the age of majority (18).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('organizer_documents', function (Blueprint $table) {
            $table->unsignedSmallInteger('audience_age')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organizer_documents', function (Blueprint $table) {
            $table->dropColumn('audience_age');
        });
    }
};
