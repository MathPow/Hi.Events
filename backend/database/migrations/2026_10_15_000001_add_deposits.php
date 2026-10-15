<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Depot de garantie: envoye par le participant a part du paiement, il n'entre
 * pas dans le total de la commande. L'organisateur le retourne ou le retient
 * (en tout ou en partie) apres l'evenement.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('deposit_amount', 10, 2)->nullable()->after('charity_amount');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('deposit_amount', 14, 2)->default(0);
            $table->string('deposit_status')->nullable();
            $table->decimal('deposit_retained_amount', 14, 2)->default(0);
            $table->text('deposit_note')->nullable();
            $table->timestamp('deposit_resolved_at')->nullable();
        });

        Schema::table('event_settings', function (Blueprint $table) {
            $table->text('deposit_instructions')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('event_settings', function (Blueprint $table) {
            $table->dropColumn('deposit_instructions');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['deposit_amount', 'deposit_status', 'deposit_retained_amount', 'deposit_note', 'deposit_resolved_at']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('deposit_amount');
        });
    }
};
