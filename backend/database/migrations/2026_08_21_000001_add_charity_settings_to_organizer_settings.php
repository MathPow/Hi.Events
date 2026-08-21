<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identite de l'organisme de bienfaisance emetteur des recus officiels.
 *
 * Portee au niveau de l'ORGANISATEUR et non de l'evenement: l'ARC exige une
 * serie de numeros unique par organisme, pas par evenement. La facturation
 * existante (invoice_prefix, invoice_start_number sur event_settings) numerote
 * par evenement -- surtout ne pas reutiliser cette sequence ici.
 *
 * charity_registration_number fait office d'interrupteur general: tant qu'il est
 * vide, aucun recu n'est emis. Seul un organisme enregistre peut en delivrer.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('organizer_settings', function (Blueprint $table) {
            $table->string('charity_registration_number')->nullable()->after('tracking_consent_acknowledged');
            $table->string('charity_legal_name')->nullable()->after('charity_registration_number');
            $table->text('charity_address')->nullable()->after('charity_legal_name');
            $table->string('charity_signatory_name')->nullable()->after('charity_address');
            $table->string('charity_receipt_prefix')->nullable()->after('charity_signatory_name');
        });
    }

    public function down(): void
    {
        Schema::table('organizer_settings', function (Blueprint $table) {
            $table->dropColumn([
                'charity_registration_number',
                'charity_legal_name',
                'charity_address',
                'charity_signatory_name',
                'charity_receipt_prefix',
            ]);
        });
    }
};
