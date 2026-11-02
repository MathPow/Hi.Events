<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * replied_at : quand l'organisateur a repondu au message depuis sa boite de reception.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('organizer_messages', function (Blueprint $table) {
            $table->timestamp('replied_at')->nullable()->after('read_at');
        });
    }

    public function down(): void
    {
        Schema::table('organizer_messages', function (Blueprint $table) {
            $table->dropColumn('replied_at');
        });
    }
};
