<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('affiliates', function (Blueprint $table) {
            $table->string('public_token', 64)->nullable()->unique();
            $table->foreignId('promo_code_id')->nullable()->constrained('promo_codes')->nullOnDelete();
        });

        DB::table('affiliates')->whereNull('public_token')->orderBy('id')->each(function ($affiliate) {
            DB::table('affiliates')
                ->where('id', $affiliate->id)
                ->update(['public_token' => Str::random(48)]);
        });
    }

    public function down(): void
    {
        Schema::table('affiliates', function (Blueprint $table) {
            $table->dropForeign(['promo_code_id']);
            $table->dropColumn(['public_token', 'promo_code_id']);
        });
    }
};
