<?php

namespace Tests\Unit\Services\Application\Handlers\CheckInList;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\CheckInListDomainObject;
use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Exceptions\DoorSalesNotEnabledException;
use HiEvents\Exceptions\NoTicketsAvailableException;
use HiEvents\Exceptions\ProductNotOnCheckInListException;
use HiEvents\Services\Application\Handlers\Attendee\CreateAttendeeHandler;
use HiEvents\Services\Application\Handlers\Attendee\DTO\CreateAttendeeDTO;
use HiEvents\Services\Application\Handlers\CheckInList\Public\CreateDoorSaleHandler;
use HiEvents\Services\Application\Handlers\CheckInList\Public\DTO\CreateDoorSaleDTO;
use HiEvents\Services\Domain\CheckInList\CreateAttendeeCheckInService;
use HiEvents\Services\Domain\DoorSale\DoorSaleListService;
use Mockery;
use Tests\TestCase;

class CreateDoorSaleHandlerTest extends TestCase
{
    private DoorSaleListService $doorSaleListService;

    private CreateAttendeeHandler $createAttendeeHandler;

    private CreateAttendeeCheckInService $createAttendeeCheckInService;

    private int $quantityRemaining = 10;

    protected function setUp(): void
    {
        parent::setUp();

        $this->doorSaleListService = Mockery::mock(DoorSaleListService::class);
        $this->createAttendeeHandler = Mockery::mock(CreateAttendeeHandler::class);
        $this->createAttendeeCheckInService = Mockery::mock(CreateAttendeeCheckInService::class);

        $this->doorSaleListService->shouldReceive('getSellableCheckInList')->andReturn($this->checkInList());
        $this->doorSaleListService->shouldReceive('verifyProductIsOnCheckInList')->andReturn($this->product());
        $this->doorSaleListService->shouldReceive('resolveProductPrice')->andReturn($this->price());
        $this->doorSaleListService->shouldReceive('resolveTaxesAndFees')->andReturn(collect());
        $this->doorSaleListService->shouldReceive('getQuantityRemaining')
            ->andReturnUsing(fn() => $this->quantityRemaining);
    }

    public function test_it_issues_one_ticket_per_requested_seat(): void
    {
        $this->createAttendeeHandler->shouldReceive('handle')->times(3)->andReturn($this->attendee());
        $this->createAttendeeCheckInService->shouldReceive('checkInAttendees')->once();

        $attendees = $this->handler()->handle($this->doorSale(quantity: 3));

        $this->assertCount(3, $attendees);
    }

    public function test_it_walks_the_buyer_straight_in_by_default(): void
    {
        $this->createAttendeeHandler->shouldReceive('handle')->andReturn($this->attendee());

        $this->createAttendeeCheckInService
            ->shouldReceive('checkInAttendees')
            ->once()
            ->withArgs(fn($listId, $ip, $attendeesAndActions) => $attendeesAndActions->count() === 1);

        $this->handler()->handle($this->doorSale());
    }

    public function test_it_can_issue_a_ticket_without_checking_it_in(): void
    {
        $this->createAttendeeHandler->shouldReceive('handle')->andReturn($this->attendee());
        $this->createAttendeeCheckInService->shouldNotReceive('checkInAttendees');

        $this->handler()->handle($this->doorSale(checkInImmediately: false));
    }

    public function test_it_refuses_to_oversell(): void
    {
        $this->quantityRemaining = 1;
        $this->createAttendeeHandler->shouldNotReceive('handle');

        $this->expectException(NoTicketsAvailableException::class);

        $this->handler()->handle($this->doorSale(quantity: 2));
    }

    public function test_it_charges_the_configured_price_rather_than_anything_the_door_types(): void
    {
        $this->createAttendeeCheckInService->shouldReceive('checkInAttendees');

        $this->createAttendeeHandler
            ->shouldReceive('handle')
            ->once()
            ->withArgs(fn(CreateAttendeeDTO $dto) => $dto->amount_paid === 25.0 && $dto->product_price_id === 5)
            ->andReturn($this->attendee());

        $this->handler()->handle($this->doorSale());
    }

    public function test_it_emails_the_ticket_when_an_address_is_given(): void
    {
        $this->createAttendeeCheckInService->shouldReceive('checkInAttendees');

        $this->createAttendeeHandler
            ->shouldReceive('handle')
            ->once()
            ->withArgs(fn(CreateAttendeeDTO $dto) => $dto->send_confirmation_email === true
                && $dto->email === 'alex@example.com')
            ->andReturn($this->attendee());

        $this->handler()->handle($this->doorSale(email: 'alex@example.com'));
    }

    public function test_it_sends_nothing_when_the_buyer_gives_no_address(): void
    {
        $this->createAttendeeCheckInService->shouldReceive('checkInAttendees');

        $this->createAttendeeHandler
            ->shouldReceive('handle')
            ->once()
            ->withArgs(fn(CreateAttendeeDTO $dto) => $dto->send_confirmation_email === false
                && str_ends_with($dto->email, '@invalid'))
            ->andReturn($this->attendee());

        $this->handler()->handle($this->doorSale());
    }

    public function test_a_list_without_door_sales_enabled_is_refused(): void
    {
        $service = Mockery::mock(DoorSaleListService::class);
        $service->shouldReceive('getSellableCheckInList')->andThrow(new DoorSalesNotEnabledException('nope'));

        $handler = new CreateDoorSaleHandler(
            $service,
            $this->createAttendeeHandler,
            $this->createAttendeeCheckInService,
        );

        $this->expectException(DoorSalesNotEnabledException::class);

        $handler->handle($this->doorSale());
    }

    public function test_a_product_that_is_not_on_the_list_is_refused(): void
    {
        $service = Mockery::mock(DoorSaleListService::class);
        $service->shouldReceive('getSellableCheckInList')->andReturn($this->checkInList());
        $service->shouldReceive('verifyProductIsOnCheckInList')
            ->andThrow(new ProductNotOnCheckInListException('nope'));

        $handler = new CreateDoorSaleHandler(
            $service,
            $this->createAttendeeHandler,
            $this->createAttendeeCheckInService,
        );

        $this->expectException(ProductNotOnCheckInListException::class);

        $handler->handle($this->doorSale());
    }

    private function handler(): CreateDoorSaleHandler
    {
        return new CreateDoorSaleHandler(
            $this->doorSaleListService,
            $this->createAttendeeHandler,
            $this->createAttendeeCheckInService,
        );
    }

    private function doorSale(
        int     $quantity = 1,
        ?string $email = null,
        bool    $checkInImmediately = true,
    ): CreateDoorSaleDTO
    {
        return new CreateDoorSaleDTO(
            checkInListShortId: 'cil_abc',
            productId: 1,
            quantity: $quantity,
            firstName: 'Alex',
            lastName: 'Tremblay',
            locale: 'fr',
            checkInUserIpAddress: '127.0.0.1',
            productPriceId: 5,
            email: $email,
            checkInImmediately: $checkInImmediately,
        );
    }

    private function checkInList(): CheckInListDomainObject
    {
        return (new CheckInListDomainObject())
            ->setId(1)
            ->setEventId(1)
            ->setShortId('cil_abc')
            ->setName('Door')
            ->setAllowDoorSales(true);
    }

    private function product(): ProductDomainObject
    {
        return (new ProductDomainObject())
            ->setId(1)
            ->setEventId(1)
            ->setTitle('General Admission')
            ->setProductType(ProductType::TICKET->name);
    }

    private function price(): ProductPriceDomainObject
    {
        return (new ProductPriceDomainObject())
            ->setId(5)
            ->setProductId(1)
            ->setPrice(25.0)
            ->setLabel('General Admission');
    }

    private function attendee(): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())
            ->setId(1)
            ->setEventId(1)
            ->setOrderId(1)
            ->setProductId(1)
            ->setProductPriceId(5)
            ->setPublicId('A-AAAAAAA')
            ->setShortId('a_aaaaaaa')
            ->setFirstName('Alex')
            ->setLastName('Tremblay')
            ->setEmail('alex@example.com');
    }
}
