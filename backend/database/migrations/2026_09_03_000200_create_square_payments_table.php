<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Equivalent Square de stripe_payments.
 *
 * Table separee plutot qu'une colonne "provider" sur stripe_payments: les deux
 * fournisseurs n'ont ni les memes identifiants ni les memes etapes (Stripe a un
 * PaymentIntent puis une Charge, Square a un Payment unique), et une table
 * commune obligerait a rendre nullable la moitie des colonnes de chaque cote.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('square_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->string('square_payment_id')->nullable()->unique();
            $table->string('square_order_id')->nullable();
            $table->string('status')->nullable();
            $table->string('merchant_id')->nullable();
            $table->string('location_id')->nullable();
            // Cle d'idempotence generee AVANT l'appel a Square et conservee: si la
            // reponse se perd (timeout reseau), rejouer la meme cle renvoie le
            // paiement deja cree au lieu de debiter l'acheteur une seconde fois.
            $table->string('idempotency_key')->nullable()->unique();
            $table->unsignedBigInteger('amount_received')->nullable();
            $table->string('currency', 3)->nullable();
            $table->string('receipt_url')->nullable();
            $table->string('card_brand')->nullable();
            $table->string('card_last_4', 4)->nullable();
            $table->bigInteger('application_fee_gross')->default(0);
            $table->bigInteger('application_fee_net')->nullable();
            $table->bigInteger('application_fee_vat')->nullable();
            $table->float('application_fee_vat_rate')->nullable();
            $table->bigInteger('processing_fee')->nullable();
            $table->bigInteger('refunded_amount')->default(0);
            $table->jsonb('last_error')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->index('order_id');
            $table->index('square_order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('square_payments');
    }
};
