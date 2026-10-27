<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Le produit avec tailles devient un produit avec options (tailles, distances,
 * categories) : l'organisateur choisit le titre que voit l'acheteur au-dessus
 * des options. Les produits existants, tous des vetements, gardent le texte
 * qu'ils affichaient.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('option_heading', 100)->nullable()->after('deposit_amount');
        });

        DB::table('products')
            ->where('type', 'SIZED')
            ->update(['option_heading' => 'Choisissez votre taille']);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('option_heading');
        });
    }
};
