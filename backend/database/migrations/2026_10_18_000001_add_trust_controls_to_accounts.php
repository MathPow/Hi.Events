<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ce qu'un compte cree par inscription publique n'obtient pas d'office:
 * encaisser sur le compte Stripe de la plateforme et emettre des recus
 * officiels de don. Un superadmin l'accorde compte par compte, et peut
 * suspendre un compte abusif.
 *
 * Les comptes existants ont tous ete crees sur invitation: ils gardent ce
 * qu'ils avaient.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->boolean('platform_payments_allowed')->default(false);
            $table->boolean('donation_receipts_allowed')->default(false);
            $table->timestamp('suspended_at')->nullable();
        });

        DB::table('accounts')->update([
            'platform_payments_allowed' => true,
            'donation_receipts_allowed' => true,
        ]);
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn(['platform_payments_allowed', 'donation_receipts_allowed', 'suspended_at']);
        });
    }
};
