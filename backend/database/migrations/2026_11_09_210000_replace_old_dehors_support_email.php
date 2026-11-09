<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    private const OLD = 'support@dehors.com';
    private const NEW = 'support@dehorsqc.com';

    public function up(): void
    {
        DB::table('organizers')->whereRaw('lower(email) = ?', [self::OLD])->update(['email' => self::NEW]);
        DB::table('event_settings')->whereRaw('lower(support_email) = ?', [self::OLD])->update(['support_email' => self::NEW]);
    }

    public function down(): void
    {
    }
};
