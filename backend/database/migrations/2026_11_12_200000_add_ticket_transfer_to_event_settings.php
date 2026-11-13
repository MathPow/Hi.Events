<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Participants may give their ticket to someone else themselves, until a number of hours before the event.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->boolean('allow_ticket_transfer')->default(false);
            $table->unsignedSmallInteger('ticket_transfer_cutoff_hours')->default(48);
        });
    }

    public function down(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->dropColumn(['allow_ticket_transfer', 'ticket_transfer_cutoff_hours']);
        });
    }
};
