<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Contribution volontaire de l'acheteur a la plateforme, choisie au paiement.
 *
 * Stockee sur la commande et NON comme ligne de produit: une ligne appartiendrait
 * a l'evenement, donc a l'organisateur, et l'argent lui reviendrait. Ici il doit
 * aller a la plateforme, via application_fee_amount sur la charge Stripe.
 *
 * Elle entre dans total_gross (facture, remboursement, rapports restent coherents
 * avec le montant reellement debite) mais reste isolee dans sa propre colonne,
 * ce qui permet de l'exclure du recu fiscal et de la reinjecter telle quelle
 * quand updateOrderTotals recalcule a partir des lignes.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('platform_contribution', 10, 2)->default(0)->after('total_gross');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('platform_contribution');
        });
    }
};
