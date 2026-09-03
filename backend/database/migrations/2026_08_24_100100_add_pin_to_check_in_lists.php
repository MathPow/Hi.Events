<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('check_in_lists', static function (Blueprint $table) {
            // Optional door code. The check-in endpoints are unauthenticated - anyone holding the
            // short_id link can read the attendee list and undo check-ins - so a list that handles
            // real attendees should be able to demand a shared secret as well as the link.
            $table->string('pin', 12)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('check_in_lists', static function (Blueprint $table) {
            $table->dropColumn('pin');
        });
    }
};
