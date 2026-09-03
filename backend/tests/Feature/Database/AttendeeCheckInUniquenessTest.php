<?php

namespace Tests\Feature\Database;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AttendeeCheckInUniquenessTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * A ticket may only be scanned once, and application code alone cannot promise that: two
     * concurrent scans both read "not checked in" before either writes. The database has to be the
     * one saying no.
     */
    public function test_a_live_check_in_is_unique_per_attendee_and_list(): void
    {
        $definition = DB::selectOne(
            'SELECT indexdef FROM pg_indexes WHERE indexname = ?',
            ['idx_attendee_check_ins_attendee_id_check_in_list_id_deleted_at'],
        );

        $this->assertNotNull($definition, 'The check-in uniqueness index is missing');
        $this->assertStringContainsString('CREATE UNIQUE INDEX', $definition->indexdef);
        $this->assertStringContainsString('attendee_id', $definition->indexdef);
        $this->assertStringContainsString('check_in_list_id', $definition->indexdef);
    }

    /**
     * Undoing a check-in soft deletes it, and the attendee must then be scannable again.
     */
    public function test_the_uniqueness_only_covers_check_ins_that_are_not_deleted(): void
    {
        $definition = DB::selectOne(
            'SELECT indexdef FROM pg_indexes WHERE indexname = ?',
            ['idx_attendee_check_ins_attendee_id_check_in_list_id_deleted_at'],
        )->indexdef;

        $this->assertStringContainsString('WHERE (deleted_at IS NULL)', $definition);
    }
}
