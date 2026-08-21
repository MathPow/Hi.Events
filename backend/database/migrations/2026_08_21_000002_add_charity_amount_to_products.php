<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Part du prix d'un produit qui constitue un DON, par unite.
 *
 * Permet le « recu fractionne » de l'ARC sur un billet-benefice: le montant
 * facture reste product_prices.price, dont charity_amount est admissible au
 * recu et le reste est la contrepartie (juste valeur marchande du billet).
 *
 * Null = produit ordinaire, aucun volet don. Les produits de type DONATION sont
 * traites separement: ils sont admissibles a 100 %, sans avoir a remplir ce champ.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('charity_amount', 10, 2)->nullable()->after('waitlist_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('charity_amount');
        });
    }
};
