<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * « Pied de page des courriels » moves from each event to the organizer (Courriels page): it starts with
 * the footer of the organizer's latest event that has one.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('organizer_settings', function (Blueprint $table) {
            $table->text('email_footer_message')->nullable();
        });

        DB::statement(<<<SQL
            UPDATE organizer_settings os
            SET email_footer_message = (
                SELECT es.email_footer_message
                FROM event_settings es
                JOIN events e ON e.id = es.event_id
                WHERE e.organizer_id = os.organizer_id
                  AND e.deleted_at IS NULL
                  AND es.email_footer_message IS NOT NULL
                  AND es.email_footer_message <> ''
                ORDER BY e.id DESC
                LIMIT 1
            )
        SQL);
    }

    public function down(): void
    {
        Schema::table('organizer_settings', function (Blueprint $table) {
            $table->dropColumn('email_footer_message');
        });
    }
};
