<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each time a participant gave their ticket to someone else: who held it, who holds it now.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('attendee_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignId('attendee_id')->constrained('attendees')->cascadeOnDelete();
            $table->string('from_first_name');
            $table->string('from_last_name');
            $table->string('from_email');
            $table->string('to_first_name');
            $table->string('to_last_name');
            $table->string('to_email');
            $table->string('ip_address', 45)->nullable();
            // When the new holder gave their own participant details (date of birth, emergency contact, health).
            $table->timestamp('details_completed_at')->nullable();
            $table->timestamps();

            $table->index('attendee_id');
            $table->index('event_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendee_transfers');
    }
};
