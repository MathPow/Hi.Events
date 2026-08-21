<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Recus officiels aux fins de l'impot.
 *
 * Deux contraintes de l'ARC dictent la forme de cette table:
 *
 * 1. Le numero est unique et jamais reutilise, meme apres annulation. D'ou
 *    l'index unique (organizer_id, receipt_number) et l'ABSENCE de suppression
 *    douce sur le numero: un recu errone n'est pas efface, il passe REPLACED et
 *    un nouveau recu le remplace en pointant replaces_receipt_id.
 * 2. Le montant admissible est le don NET de l'avantage recu. On fige donc les
 *    trois montants au moment de l'emission plutot que de les recalculer:
 *    total_received = eligible_amount + advantage_amount.
 *
 * Le nom et l'adresse du donateur sont recopies ici et non lus depuis la
 * commande: le recu doit rester fidele a ce qui a ete emis, meme si l'acheteur
 * modifie son profil ensuite.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('donation_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('organizer_id')->constrained()->cascadeOnDelete();
            $table->string('receipt_number');
            $table->unsignedSmallInteger('receipt_year');
            $table->date('issue_date');
            $table->date('donation_date');
            $table->string('donor_name');
            $table->text('donor_address')->nullable();
            $table->decimal('total_received', 10, 2);
            $table->decimal('advantage_amount', 10, 2)->default(0);
            $table->decimal('eligible_amount', 10, 2);
            $table->string('currency', 3);
            $table->string('charity_registration_number');
            $table->string('charity_legal_name');
            $table->text('charity_address')->nullable();
            $table->string('charity_signatory_name')->nullable();
            $table->string('status')->default('ISSUED');
            $table->foreignId('replaces_receipt_id')->nullable()->constrained('donation_receipts')->nullOnDelete();
            $table->uuid()->default(DB::raw('gen_random_uuid()'))->unique();
            $table->timestamps();

            $table->unique(['organizer_id', 'receipt_number']);
            $table->index(['organizer_id', 'receipt_year']);
            $table->index('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('donation_receipts');
    }
};
