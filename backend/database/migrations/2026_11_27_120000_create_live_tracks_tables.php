<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * « Suivi en direct »: a participant shares their Garmin LiveTrack link from their ticket, the
 * billetterie reads their position every minute and the organizer sees everyone on the course.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->boolean('live_tracking_enabled')->default(false);
        });

        Schema::create('live_tracks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignId('attendee_id')->constrained('attendees')->cascadeOnDelete();
            $table->string('provider', 30)->default('GARMIN_LIVETRACK');
            $table->text('share_url');
            $table->string('session_id', 100);
            $table->string('session_token', 255);
            $table->string('status', 20)->default('WAITING');
            $table->string('last_error', 255)->nullable();
            $table->timestamp('consented_at');
            $table->timestamp('last_polled_at')->nullable();
            $table->timestamp('last_point_at')->nullable();
            $table->timestamp('still_since')->nullable();
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();
            $table->float('altitude_m')->nullable();
            $table->float('speed_mps')->nullable();
            $table->float('distance_m')->nullable();
            $table->integer('duration_s')->nullable();
            $table->float('elevation_gain_m')->nullable();
            $table->smallInteger('heart_rate')->nullable();
            $table->smallInteger('cadence')->nullable();
            $table->integer('points_count')->default(0);
            $table->timestamps();

            $table->unique('attendee_id');
            $table->index(['event_id', 'status']);
        });

        Schema::create('live_track_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_track_id')->constrained('live_tracks')->cascadeOnDelete();
            $table->timestamp('recorded_at');
            $table->double('latitude');
            $table->double('longitude');
            $table->float('altitude_m')->nullable();
            $table->float('speed_mps')->nullable();
            $table->float('distance_m')->nullable();
            $table->smallInteger('heart_rate')->nullable();

            $table->unique(['live_track_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_track_points');
        Schema::dropIfExists('live_tracks');

        Schema::table('event_settings', function (Blueprint $table) {
            $table->dropColumn('live_tracking_enabled');
        });
    }
};
