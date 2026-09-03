<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('check_in_lists', static function (Blueprint $table) {
            // Selling at the door creates real orders from an unauthenticated page, so it stays off
            // until an organiser turns it on for a specific list.
            $table->boolean('allow_door_sales')->default(false)->after('pin');
        });
    }

    public function down(): void
    {
        Schema::table('check_in_lists', static function (Blueprint $table) {
            $table->dropColumn('allow_door_sales');
        });
    }
};
