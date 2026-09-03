<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Invitations nominatives a creer un compte, quand l'inscription publique est
 * fermee (APP_DISABLE_REGISTRATION).
 *
 * Seul le hash du jeton est stocke: la base ne doit pas contenir de quoi
 * fabriquer un compte si elle fuit. Le jeton en clair n'existe qu'une fois, dans
 * la reponse de creation.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('account_registration_invites', function (Blueprint $table) {
            $table->id();
            $table->string('token_hash', 64)->unique();
            $table->string('email')->nullable();
            $table->string('label')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('used_at')->nullable();
            $table->unsignedBigInteger('used_by_account_id')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->unsignedBigInteger('created_by_user_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('used_by_account_id')->references('id')->on('accounts')->onDelete('set null');
            $table->foreign('created_by_user_id')->references('id')->on('users')->onDelete('set null');
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_registration_invites');
    }
};
