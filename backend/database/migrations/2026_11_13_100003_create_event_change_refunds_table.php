<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('event_change_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignId('order_id')->unique()->constrained('orders')->cascadeOnDelete();
            $table->foreignId('event_date_change_id')->nullable()->constrained('event_date_changes')->nullOnDelete();
            $table->foreignId('event_cancellation_id')->nullable()->constrained('event_cancellations')->nullOnDelete();
            $table->string('status', 40);
            $table->decimal('amount', 14, 2)->default(0);
            $table->string('currency', 3)->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index(['event_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_change_refunds');
    }
};
