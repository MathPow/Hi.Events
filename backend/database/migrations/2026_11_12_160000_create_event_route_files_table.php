<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The GPX courses of an event (« 10 km », « 21 km »): uploaded by the organizer in the event's
 * settings, downloaded by participants from their ticket and their ticket email.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('event_route_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->string('label', 100);
            $table->string('original_filename', 255);
            $table->string('disk', 50);
            $table->string('path', 255);
            $table->unsignedBigInteger('size');
            $table->timestamps();
            $table->softDeletes();

            $table->index('event_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_route_files');
    }
};
