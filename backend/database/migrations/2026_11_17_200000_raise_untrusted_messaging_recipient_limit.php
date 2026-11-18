<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Un message aux participants d'une course de 150 a 1000 coureurs doit pouvoir partir
// d'un compte Untrusted : le plafond par message passe de 100 a 1000.
return new class extends Migration {
    public function up(): void
    {
        DB::table('account_messaging_tiers')
            ->where('name', 'Untrusted')
            ->update(['max_recipients_per_message' => 1000, 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('account_messaging_tiers')
            ->where('name', 'Untrusted')
            ->update(['max_recipients_per_message' => 100, 'updated_at' => now()]);
    }
};
