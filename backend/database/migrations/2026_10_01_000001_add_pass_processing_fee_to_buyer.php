<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->boolean('pass_processing_fee_to_buyer')->default(false);
        });

        Schema::table('organizer_settings', function (Blueprint $table) {
            $table->boolean('default_pass_processing_fee_to_buyer')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->dropColumn('pass_processing_fee_to_buyer');
        });

        Schema::table('organizer_settings', function (Blueprint $table) {
            $table->dropColumn('default_pass_processing_fee_to_buyer');
        });
    }
};
