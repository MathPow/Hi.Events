<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    private const INDEX_NAME = 'idx_attendee_check_ins_attendee_id_check_in_list_id_deleted_at';

    public function up(): void
    {
        // The index this replaces was not unique, so duplicate check-ins could be created by two
        // concurrent scans of the same ticket. Soft delete any duplicates that already exist,
        // keeping the earliest check-in for each (attendee, check-in list) pair.
        DB::statement('
            UPDATE attendee_check_ins
            SET deleted_at = NOW()
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY attendee_id, check_in_list_id
                               ORDER BY created_at, id
                           ) AS duplicate_position
                    FROM attendee_check_ins
                    WHERE deleted_at IS NULL
                ) ranked
                WHERE ranked.duplicate_position > 1
            )
        ');

        DB::statement('DROP INDEX IF EXISTS ' . self::INDEX_NAME);

        DB::statement('
            CREATE UNIQUE INDEX ' . self::INDEX_NAME . '
            ON attendee_check_ins(attendee_id, check_in_list_id)
            WHERE deleted_at IS NULL
        ');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS ' . self::INDEX_NAME);

        DB::statement('
            CREATE INDEX ' . self::INDEX_NAME . '
            ON attendee_check_ins(attendee_id, check_in_list_id)
            WHERE deleted_at IS NULL
        ');
    }
};
