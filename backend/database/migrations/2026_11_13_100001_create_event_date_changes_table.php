<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('event_date_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('old_start_date');
            $table->timestamp('old_end_date')->nullable();
            $table->timestamp('new_start_date');
            $table->timestamp('new_end_date')->nullable();
            $table->boolean('refunds_allowed')->default(false);
            $table->timestamp('refund_deadline')->nullable();
            $table->text('message');
            $table->unsignedInteger('recipients_count')->default(0);
            $table->timestamps();

            $table->index(['event_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_date_changes');
    }
};
