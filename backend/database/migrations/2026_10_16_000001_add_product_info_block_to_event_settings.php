<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->text('product_info_message')->nullable();
            $table->string('product_info_button_text', 100)->nullable();
            $table->string('product_info_button_url', 2048)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->dropColumn([
                'product_info_message',
                'product_info_button_text',
                'product_info_button_url',
            ]);
        });
    }
};
