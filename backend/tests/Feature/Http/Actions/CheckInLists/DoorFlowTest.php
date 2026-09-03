<?php

namespace Tests\Feature\Http\Actions\CheckInLists;

use HiEvents\Http\Middleware\ValidateCheckInListPin;
use HiEvents\Http\ResponseCodes;
use HiEvents\Models\AccountConfiguration;
use HiEvents\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Walks the whole door: an organiser sets up a PIN protected check-in list that may sell tickets,
 * then a volunteer scans, sells, and tries to scan the same ticket twice.
 */
class DoorFlowTest extends TestCase
{
    use DatabaseTransactions;

    private const PIN = '482915';

    private string $authToken;

    private int $eventId;

    private int $productId;

    private int $productPriceId;

    private string $checkInListShortId;

    private int $taxId;

    protected function setUp(): void
    {
        parent::setUp();

        AccountConfiguration::firstOrCreate(['id' => 1], [
            'id' => 1,
            'name' => 'Default',
            'is_system_default' => true,
            'application_fees' => ['percentage' => 1.5, 'fixed' => 0],
        ]);

        $password = 'password123';
        $user = User::factory()->password($password)->withAccount()->create();

        $this->authToken = $this->postJson('/auth/login', [
            'email' => $user->email,
            'password' => $password,
        ])->headers->get('X-Auth-Token');

        $this->createEventWithATicket();
        $this->createCheckInList();
    }

    public function test_the_attendee_list_is_not_readable_without_the_pin(): void
    {
        $this->getJson("/public/check-in-lists/{$this->checkInListShortId}/attendees")
            ->assertStatus(ResponseCodes::HTTP_UNAUTHORIZED)
            ->assertJsonPath('code', ValidateCheckInListPin::PIN_REQUIRED_CODE);
    }

    public function test_a_wrong_pin_is_rejected(): void
    {
        $this->getJson(
            "/public/check-in-lists/{$this->checkInListShortId}/attendees",
            [ValidateCheckInListPin::PIN_HEADER => '000000'],
        )
            ->assertStatus(ResponseCodes::HTTP_UNAUTHORIZED)
            ->assertJsonPath('code', ValidateCheckInListPin::PIN_INVALID_CODE);
    }

    public function test_the_right_pin_opens_the_list(): void
    {
        $this->getJson(
            "/public/check-in-lists/{$this->checkInListShortId}/attendees",
            $this->doorHeaders(),
        )->assertStatus(ResponseCodes::HTTP_OK);
    }

    public function test_the_list_itself_stays_readable_so_the_app_can_ask_for_the_pin(): void
    {
        $this->getJson("/public/check-in-lists/{$this->checkInListShortId}")
            ->assertStatus(ResponseCodes::HTTP_OK)
            ->assertJsonPath('data.requires_pin', true)
            ->assertJsonPath('data.allow_door_sales', true)
            ->assertJsonMissingPath('data.pin');
    }

    public function test_the_door_can_see_what_is_left_to_sell(): void
    {
        $this->getJson(
            "/public/check-in-lists/{$this->checkInListShortId}/door-sale-products",
            $this->doorHeaders(),
        )
            ->assertStatus(ResponseCodes::HTTP_OK)
            ->assertJsonPath('data.0.title', 'General Admission')
            ->assertJsonPath('data.0.prices.0.quantity_remaining', 50);
    }

    public function test_a_door_sale_issues_a_ticket_and_walks_the_buyer_in(): void
    {
        $response = $this->postJson(
            "/public/check-in-lists/{$this->checkInListShortId}/door-sales",
            [
                'product_id' => $this->productId,
                'product_price_id' => $this->productPriceId,
                'quantity' => 1,
                'first_name' => 'Alex',
                'last_name' => 'Tremblay',
                'check_in_immediately' => true,
            ],
            $this->doorHeaders(),
        );

        $response->assertStatus(ResponseCodes::HTTP_CREATED);

        $publicId = $response->json('data.0.public_id');

        $this->assertNotNull($publicId);

        $this->getJson(
            "/public/check-in-lists/{$this->checkInListShortId}/attendees/{$publicId}",
            $this->doorHeaders(),
        )
            ->assertStatus(ResponseCodes::HTTP_OK)
            ->assertJsonPath('data.public_id', $publicId);
    }

    public function test_a_door_sale_consumes_stock(): void
    {
        $this->postJson(
            "/public/check-in-lists/{$this->checkInListShortId}/door-sales",
            [
                'product_id' => $this->productId,
                'product_price_id' => $this->productPriceId,
                'quantity' => 2,
                'first_name' => 'Alex',
                'check_in_immediately' => false,
            ],
            $this->doorHeaders(),
        )->assertStatus(ResponseCodes::HTTP_CREATED);

        $this->getJson(
            "/public/check-in-lists/{$this->checkInListShortId}/door-sale-products",
            $this->doorHeaders(),
        )->assertJsonPath('data.0.prices.0.quantity_remaining', 48);
    }

    public function test_a_door_sale_needs_the_pin_too(): void
    {
        $this->postJson(
            "/public/check-in-lists/{$this->checkInListShortId}/door-sales",
            [
                'product_id' => $this->productId,
                'quantity' => 1,
                'first_name' => 'Alex',
            ],
        )->assertStatus(ResponseCodes::HTTP_UNAUTHORIZED);
    }

    public function test_a_ticket_can_only_be_scanned_once(): void
    {
        $publicId = $this->postJson(
            "/public/check-in-lists/{$this->checkInListShortId}/door-sales",
            [
                'product_id' => $this->productId,
                'quantity' => 1,
                'first_name' => 'Alex',
                'check_in_immediately' => false,
            ],
            $this->doorHeaders(),
        )->json('data.0.public_id');

        $checkIn = fn() => $this->postJson(
            "/public/check-in-lists/{$this->checkInListShortId}/check-ins",
            ['attendees' => [['public_id' => $publicId, 'action' => 'check-in']]],
            $this->doorHeaders(),
        );

        $first = $checkIn();

        $first->assertStatus(ResponseCodes::HTTP_OK);
        $this->assertArrayNotHasKey($publicId, $first->json('errors') ?? []);

        $second = $checkIn();

        $second->assertStatus(ResponseCodes::HTTP_OK);
        // The message itself is translated, so assert on the ticket the door was refused.
        $this->assertArrayHasKey($publicId, $second->json('errors'));
    }

    public function test_a_door_sale_charges_the_ticket_taxes(): void
    {
        $publicId = $this->postJson(
            "/public/check-in-lists/{$this->checkInListShortId}/door-sales",
            [
                'product_id' => $this->productId,
                'product_price_id' => $this->productPriceId,
                'quantity' => 1,
                'first_name' => 'Alex',
                'check_in_immediately' => false,
            ],
            $this->doorHeaders(),
        )->json('data.0.public_id');

        $order = DB::table('orders')
            ->join('attendees', 'attendees.order_id', '=', 'orders.id')
            ->where('attendees.public_id', $publicId)
            ->select('orders.total_gross', 'orders.total_tax')
            ->first();

        // 25.00 ticket plus the 10% tax configured on it.
        $this->assertEquals(2.50, round((float)$order->total_tax, 2));
        $this->assertEquals(27.50, round((float)$order->total_gross, 2));
    }

    private function doorHeaders(): array
    {
        return [ValidateCheckInListPin::PIN_HEADER => self::PIN];
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer ' . $this->authToken];
    }

    private function createEventWithATicket(): void
    {
        $organizerId = $this->postJson('/organizers', [
            'name' => 'DEHORS',
            'email' => 'organizer@example.com',
            'timezone' => 'America/Toronto',
            'currency' => 'CAD',
        ], $this->authHeaders())->json('data.id');

        $this->eventId = $this->postJson('/events', [
            'title' => 'Summer Fest',
            'organizer_id' => $organizerId,
            'start_date' => '2027-09-01T18:00:00',
            'end_date' => '2027-09-01T23:00:00',
            'timezone' => 'America/Toronto',
            'currency' => 'CAD',
        ], $this->authHeaders())->json('data.id');

        $categoryId = $this->postJson("/events/{$this->eventId}/product-categories", [
            'name' => 'Tickets',
            'is_hidden' => false,
        ], $this->authHeaders())->json('data.id');

        $accountId = $this->getJson('/accounts', $this->authHeaders())->json('data.id');

        $this->taxId = $this->postJson("/accounts/{$accountId}/taxes-and-fees", [
            'name' => 'TPS',
            'calculation_type' => 'PERCENTAGE',
            'type' => 'TAX',
            'rate' => 10,
            'is_active' => true,
            'is_default' => false,
            // The DTO behind this endpoint requires the key even though validation calls it optional.
            'description' => null,
        ], $this->authHeaders())->json('data.id');

        $product = $this->postJson("/events/{$this->eventId}/products", [
            'title' => 'General Admission',
            'type' => 'PAID',
            'product_type' => 'TICKET',
            'product_category_id' => $categoryId,
            'tax_and_fee_ids' => [$this->taxId],
            'prices' => [
                ['price' => 25.00, 'initial_quantity_available' => 50],
            ],
        ], $this->authHeaders())->json('data');

        $this->productId = $product['id'];
        $this->productPriceId = $product['prices'][0]['id'];
    }

    private function createCheckInList(): void
    {
        $this->checkInListShortId = $this->postJson("/events/{$this->eventId}/check-in-lists", [
            'name' => 'Door',
            'description' => null,
            'product_ids' => [$this->productId],
            'pin' => self::PIN,
            'allow_door_sales' => true,
        ], $this->authHeaders())->json('data.short_id');
    }
}
