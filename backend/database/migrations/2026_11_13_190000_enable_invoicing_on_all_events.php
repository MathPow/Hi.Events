<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_settings', function ($table) {
            $table->boolean('enable_invoicing')->default(true)->change();
        });

        DB::table('event_settings')
            ->where('enable_invoicing', false)
            ->update(['enable_invoicing' => true]);
    }

    public function down(): void
    {
        Schema::table('event_settings', function ($table) {
            $table->boolean('enable_invoicing')->default(false)->change();
        });
    }
};
