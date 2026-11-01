<?php

namespace Tests\Feature\Database;

use HiEvents\Http\DTO\QueryParamsDTO;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class OrganizerOrdersFilterTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * The organizer's orders are joined with their events, which have a status too: a status filter
     * has to name the orders' column or PostgreSQL refuses the ambiguous query.
     */
    public function test_filtering_the_organizer_orders_by_status_runs(): void
    {
        $orders = app(OrderRepositoryInterface::class)->findByOrganizerId(
            organizerId: 0,
            accountId: 0,
            params: QueryParamsDTO::fromArray([
                'per_page' => 5,
                'filter_fields' => [['field' => 'status', 'operator' => 'eq', 'value' => 'AWAITING_OFFLINE_PAYMENT']],
            ]),
        );

        $this->assertSame(0, $orders->total());
    }
}
