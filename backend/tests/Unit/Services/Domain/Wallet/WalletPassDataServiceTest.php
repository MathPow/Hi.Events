<?php

namespace Tests\Unit\Services\Domain\Wallet;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Exceptions\WalletPassUnavailableException;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use HiEvents\Services\Domain\Wallet\WalletPassDataService;
use Illuminate\Config\Repository;
use Mockery as m;
use Mockery\MockInterface;
use Tests\TestCase;

class WalletPassDataServiceTest extends TestCase
{
    private OrderRepositoryInterface&MockInterface $orderRepository;
    private WalletPassDataService $service;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.frontend_url' => 'https://billets.example.com']);
        app()->setLocale('en');

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->orderRepository->shouldReceive('loadRelation')->andReturnSelf();

        $this->service = new WalletPassDataService(
            $this->orderRepository,
            new EventEmailBrandingService(app(Repository::class), m::mock(EventRepositoryInterface::class)),
        );
    }

    public function testOnePassPerActiveAttendeeInTheLanguageOfTheOrder(): void
    {
        $this->orderRepository->shouldReceive('findByShortId')->with('o_abc')->andReturn($this->order());

        $wallet = $this->service->forOrder(11, 'o_abc');

        $this->assertSame('fr', $wallet->locale);
        $this->assertSame('O-123', $wallet->orderPublicId);
        $this->assertCount(1, $wallet->tickets);
        $this->assertSame('A-ACTIVE', $wallet->tickets[0]->publicId);
        $this->assertSame('Léa Tremblay', $wallet->tickets[0]->holderName);
        $this->assertSame('Admission générale', $wallet->tickets[0]->ticketName);

        $event = $wallet->event;
        $this->assertSame('Backyard Boréal', $event->title);
        $this->assertSame('Boréal', $event->organizerName);
        $this->assertSame('#1d6fd8', $event->backgroundColor);
        $this->assertSame('#fffcf8', $event->foregroundColor);
        $this->assertSame('2030-10-26T08:00:00-04:00', $event->startDate);
        $this->assertSame('26 oct.', $event->shortDate);
        $this->assertSame('Sam. 26 oct. · 08:00', $event->dateTimeLine);
        $this->assertSame('Mont Orford', $event->placeLine);
        $this->assertSame('logo.png', $event->logo?->getPath());
        $this->assertSame('cover.webp', $event->cover?->getPath());
        // The language comes back to the request's after.
        $this->assertSame('en', app()->getLocale());
    }

    public function testAnOrderOfAnotherEventIsNotFound(): void
    {
        $this->orderRepository->shouldReceive('findByShortId')->andReturn($this->order());

        $this->expectException(ResourceNotFoundException::class);
        $this->service->forOrder(99, 'o_abc');
    }

    public function testAnUnpaidOrderHasNoPass(): void
    {
        $this->orderRepository->shouldReceive('findByShortId')
            ->andReturn($this->order()->setStatus(OrderStatus::AWAITING_OFFLINE_PAYMENT->name));

        $this->expectException(WalletPassUnavailableException::class);
        $this->service->forOrder(11, 'o_abc');
    }

    public function testAnOrderWithoutActiveTicketHasNoPass(): void
    {
        $order = $this->order();
        $order->setAttendees(collect([$this->attendee('A-GONE', AttendeeStatus::CANCELLED)]));
        $this->orderRepository->shouldReceive('findByShortId')->andReturn($order);

        $this->expectException(WalletPassUnavailableException::class);
        $this->service->forOrder(11, 'o_abc');
    }

    private function order(): OrderDomainObject
    {
        $organizer = (new OrganizerDomainObject())
            ->setName('Boréal')
            ->setEmail('bonjour@boreal.ca')
            ->setOrganizerSettings(new OrganizerSettingDomainObject())
            ->setImages(collect([$this->image(ImageType::ORGANIZER_LOGO, 'logo.png')]));

        $settings = (new EventSettingDomainObject())
            ->setHomepageThemeSettings(['accent' => '#1d6fd8'])
            ->setLocationDetails(['venue_name' => 'Mont Orford', 'city' => 'Orford']);

        $event = (new EventDomainObject())
            ->setId(11)
            ->setTitle('Backyard Boréal')
            ->setTimezone('America/Toronto')
            ->setStartDate('2030-10-26 12:00:00')
            ->setEndDate('2030-10-26 20:00:00')
            ->setEventSettings($settings)
            ->setOrganizer($organizer)
            ->setImages(collect([$this->image(ImageType::EVENT_COVER, 'cover.webp')]));

        return (new OrderDomainObject())
            ->setId(5)
            ->setEventId(11)
            ->setPublicId('O-123')
            ->setLocale('fr')
            ->setStatus(OrderStatus::COMPLETED->name)
            ->setEvent($event)
            ->setAttendees(collect([
                $this->attendee('A-ACTIVE', AttendeeStatus::ACTIVE),
                $this->attendee('A-GONE', AttendeeStatus::CANCELLED),
            ]));
    }

    private function attendee(string $publicId, AttendeeStatus $status): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())
            ->setId(crc32($publicId))
            ->setPublicId($publicId)
            ->setStatus($status->name)
            ->setFirstName('Léa')
            ->setLastName('Tremblay')
            ->setProduct((new ProductDomainObject())->setTitle('Admission générale'));
    }

    private function image(ImageType $type, string $path): ImageDomainObject
    {
        return (new ImageDomainObject())->setType($type->name)->setPath($path);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
