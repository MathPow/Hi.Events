<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La boite de reception des organisateurs et les notifications Web Push.
 *
 * - organizer_messages : chaque message du bouton « Contacter » (page de l'organisateur ou d'un
 *   evenement), garde en plus du courriel ; read_at dit s'il a ete lu dans le tableau de bord.
 * - push_subscriptions : les appareils d'un utilisateur qui ont accepte les notifications.
 * - web_push_keys : la paire de cles VAPID du serveur, creee au premier envoi (rien a regler).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('organizer_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organizer_id')->constrained('organizers')->cascadeOnDelete();
            $table->foreignId('event_id')->nullable()->constrained('events')->nullOnDelete();
            $table->string('sender_name', 255);
            $table->string('sender_email', 255);
            $table->text('message');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organizer_id', 'created_at']);
        });

        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('endpoint');
            // L'adresse d'un appareil est longue: son empreinte sert de cle unique.
            $table->string('endpoint_hash', 64)->unique();
            $table->string('public_key', 255);
            $table->string('auth_token', 255);
            $table->string('content_encoding', 20)->default('aes128gcm');
            $table->string('user_agent', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('web_push_keys', function (Blueprint $table) {
            $table->id();
            $table->text('public_key');
            $table->text('private_key');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('web_push_keys');
        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('organizer_messages');
    }
};
