<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Wallet;

use Carbon\Carbon;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\ImageType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrganizerDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\ProductDomainObjectAbstract;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Exceptions\WalletPassUnavailableException;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use HiEvents\Services\Domain\Wallet\DTO\WalletEventDTO;
use HiEvents\Services\Domain\Wallet\DTO\WalletOrderDTO;
use HiEvents\Services\Domain\Wallet\DTO\WalletTicketDTO;
use Illuminate\Support\Collection;
use Illuminate\Support\Traits\Localizable;

/**
 * The tickets of a paid order, ready for Apple or Google Wallet: one pass per attendee, with the
 * QR code of the confirmation page and the look of the event page (the organizer's color and logo).
 */
class WalletPassDataService
{
    use Localizable;

    private const PLATFORM_NAME = 'Billetterie Dehors';

    public function __construct(
        private readonly OrderRepositoryInterface   $orderRepository,
        private readonly EventEmailBrandingService $brandingService,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     * @throws WalletPassUnavailableException
     */
    public function forOrder(int $eventId, string $orderShortId): WalletOrderDTO
    {
        $order = $this->loadOrder($orderShortId);

        if ($order === null || $order->getEventId() !== $eventId || $order->getEvent() === null) {
            throw new ResourceNotFoundException(__('Order not found'));
        }

        if ($order->getStatus() !== OrderStatus::COMPLETED->name) {
            throw new WalletPassUnavailableException(__('Your tickets can be added to a wallet once the order is confirmed.'));
        }

        $attendees = ($order->getAttendees() ?? collect())
            ->filter(fn(AttendeeDomainObject $attendee) => $attendee->getStatus() === AttendeeStatus::ACTIVE->name)
            ->values();

        if ($attendees->isEmpty()) {
            throw new WalletPassUnavailableException(__('This order has no ticket to add to a wallet.'));
        }

        $locale = $order->getLocale() ?: app()->getLocale();

        return $this->withLocale($locale, fn() => new WalletOrderDTO(
            orderPublicId: $order->getPublicId(),
            locale: $locale,
            event: $this->event($order->getEvent()),
            tickets: $attendees->map(fn(AttendeeDomainObject $attendee) => new WalletTicketDTO(
                attendeeId: $attendee->getId(),
                publicId: $attendee->getPublicId(),
                holderName: trim($attendee->getFirstName() . ' ' . $attendee->getLastName()),
                ticketName: $attendee->getProduct()?->getTitle(),
            ))->all(),
        ));
    }

    private function event(EventDomainObject $event): WalletEventDTO
    {
        $branding = $this->brandingService->forEvent($event);
        $timezone = $event->getTimezone() ?: 'UTC';
        $locale = app()->getLocale();
        $start = $event->getStartDate() ? Carbon::parse($event->getStartDate(), 'UTC')->setTimezone($timezone)->locale($locale) : null;
        $end = $event->getEndDate() ? Carbon::parse($event->getEndDate(), 'UTC')->setTimezone($timezone)->locale($locale) : null;

        return new WalletEventDTO(
            eventId: $event->getId(),
            title: (string)$event->getTitle(),
            organizerName: $branding->organizerName ?? self::PLATFORM_NAME,
            supportEmail: $branding->supportEmail,
            eventUrl: $branding->eventUrl,
            backgroundColor: $branding->accentColor,
            foregroundColor: $branding->accentTextColor,
            labelColor: $this->mix($branding->accentTextColor, $branding->accentColor, 0.72),
            startDate: $start?->toIso8601String(),
            endDate: $end?->toIso8601String(),
            shortDate: $start ? $this->capitalize($start->isoFormat('D MMM')) : null,
            dateTimeLine: $start ? $this->capitalize($start->isoFormat('ddd D MMM · LT')) : null,
            dateLine: $branding->dateLine,
            timezoneLine: $branding->timezoneLine,
            placeLine: $branding->placeLine,
            addressLine: $branding->addressLine,
            logo: $this->findImage($event->getOrganizer()?->getImages(), ImageType::ORGANIZER_LOGO),
            cover: $this->findImage($event->getImages(), ImageType::EVENT_COVER),
        );
    }

    private function loadOrder(string $orderShortId): ?OrderDomainObject
    {
        return $this->orderRepository
            ->loadRelation(new Relationship(
                domainObject: AttendeeDomainObject::class,
                nested: [
                    new Relationship(
                        domainObject: ProductDomainObject::class,
                        name: ProductDomainObjectAbstract::SINGULAR_NAME,
                    ),
                ],
            ))
            ->loadRelation(new Relationship(
                domainObject: EventDomainObject::class,
                nested: [
                    new Relationship(EventSettingDomainObject::class),
                    new Relationship(ImageDomainObject::class),
                    new Relationship(
                        domainObject: OrganizerDomainObject::class,
                        nested: [
                            new Relationship(ImageDomainObject::class),
                            new Relationship(OrganizerSettingDomainObject::class),
                        ],
                        name: OrganizerDomainObjectAbstract::SINGULAR_NAME,
                    ),
                ],
                name: EventDomainObjectAbstract::SINGULAR_NAME,
            ))
            ->findByShortId($orderShortId);
    }

    private function findImage(?Collection $images, ImageType $type): ?ImageDomainObject
    {
        return $images?->first(fn(ImageDomainObject $image) => $image->getType() === $type->name);
    }

    private function mix(string $color, string $base, float $weight): string
    {
        $a = sscanf($color, '#%02x%02x%02x');
        $b = sscanf($base, '#%02x%02x%02x');

        return vsprintf('#%02x%02x%02x', array_map(
            fn(int $i) => (int)round($a[$i] * $weight + $b[$i] * (1 - $weight)),
            [0, 1, 2],
        ));
    }

    private function capitalize(string $text): string
    {
        return mb_strtoupper(mb_substr($text, 0, 1)) . mb_substr($text, 1);
    }
}
