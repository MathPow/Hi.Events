<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Email;

use Carbon\Carbon;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\ProductDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\Status\OrderPaymentStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Mail\Attendee\AttendeeTicketMail;
use HiEvents\Mail\Order\OrderSummary;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;

/**
 * The automatic emails of an organizer, as they would be sent, for the preview and the test send of
 * Settings → Emails. The organizer's latest event provides the event details; the buyer is made up.
 * Event-level templates are ignored: the page shows the organizer's own version.
 */
class SampleEmailService
{
    public const SAMPLE_FIRST_NAME = 'Marie';
    public const SAMPLE_LAST_NAME = 'Tremblay';
    public const SAMPLE_EMAIL = 'marie.tremblay@example.com';

    private const SAMPLE_QUANTITY = 2;
    private const SAMPLE_TICKET_PRICE = 35.0;
    private const SAMPLE_PRODUCT_PRICE_ID = -1;

    public function __construct(
        private readonly EventRepositoryInterface   $eventRepository,
        private readonly ProductRepositoryInterface $productRepository,
        private readonly EmailTemplateService       $emailTemplateService,
        private readonly EmailTokenContextBuilder   $tokenContextBuilder,
    )
    {
    }

    public function buildMail(EmailTemplateType $type, OrganizerDomainObject $organizer): OrderSummary|AttendeeTicketMail
    {
        $event = $this->sampleEvent($organizer);
        $eventSettings = $event->getEventSettings() ?? $this->sampleEventSettings($organizer);
        $orderItem = $this->sampleOrderItem($event);
        $order = $this->sampleOrder($event, $orderItem);
        $attendee = $this->sampleAttendee($orderItem);

        $template = $this->emailTemplateService->getTemplateByType(
            type: $type,
            accountId: $organizer->getAccountId(),
            organizerId: $organizer->getId(),
        );

        if ($type === EmailTemplateType::ATTENDEE_TICKET) {
            // The PDF ticket and the calendar file are left out: only the message is shown or sent.
            return new class(
                order: $order,
                attendee: $attendee,
                event: $event,
                eventSettings: $eventSettings,
                organizer: $organizer,
                renderedTemplate: $template === null ? null : $this->emailTemplateService->renderTemplate(
                    $template,
                    $this->tokenContextBuilder->buildAttendeeTicketContext($attendee, $order, $event, $organizer, $eventSettings),
                ),
            ) extends AttendeeTicketMail {
                public function attachments(): array
                {
                    return [];
                }
            };
        }

        return new OrderSummary(
            order: $order,
            event: $event,
            organizer: $organizer,
            eventSettings: $eventSettings,
            invoice: null,
            renderedTemplate: $template === null ? null : $this->emailTemplateService->renderTemplate(
                $template,
                $this->tokenContextBuilder->buildOrderConfirmationContext($order, $event, $organizer, $eventSettings),
            ),
        );
    }

    private function sampleEvent(OrganizerDomainObject $organizer): EventDomainObject
    {
        /** @var EventDomainObject|null $event */
        $event = $this->eventRepository
            ->loadRelation(new Relationship(EventSettingDomainObject::class))
            ->findWhere(
                where: [EventDomainObjectAbstract::ORGANIZER_ID => $organizer->getId()],
                orderAndDirections: [new OrderAndDirection(EventDomainObjectAbstract::START_DATE, OrderAndDirection::DIRECTION_DESC)],
            )
            ->first();

        if ($event !== null) {
            return $event;
        }

        $timezone = $organizer->getTimezone() ?: 'UTC';
        $startDate = Carbon::now($timezone)->addWeeks(2)->setTime(9, 0)->utc();

        return (new EventDomainObject())
            ->setId(0)
            ->setAccountId($organizer->getAccountId())
            ->setOrganizerId($organizer->getId())
            ->setTitle(__('Your event'))
            ->setStartDate($startDate->toDateTimeString())
            ->setTimezone($timezone)
            ->setCurrency($organizer->getCurrency() ?: 'CAD')
            ->setEventSettings($this->sampleEventSettings($organizer));
    }

    private function sampleEventSettings(OrganizerDomainObject $organizer): EventSettingDomainObject
    {
        return (new EventSettingDomainObject())
            ->setSupportEmail($organizer->getEmail());
    }

    private function sampleOrderItem(EventDomainObject $event): OrderItemDomainObject
    {
        $product = $event->getId() === 0
            ? null
            : $this->productRepository
                ->loadRelation(ProductPriceDomainObject::class)
                ->findFirstWhere([
                    ProductDomainObjectAbstract::EVENT_ID => $event->getId(),
                    ProductDomainObjectAbstract::PRODUCT_TYPE => ProductType::TICKET->name,
                ]);

        /** @var ProductPriceDomainObject|null $price */
        $price = $product instanceof ProductDomainObject ? $product->getProductPrices()?->first() : null;
        $unitPrice = $price !== null && $price->getPrice() > 0 ? $price->getPrice() : self::SAMPLE_TICKET_PRICE;

        return (new OrderItemDomainObject())
            ->setProductPriceId($price?->getId() ?? self::SAMPLE_PRODUCT_PRICE_ID)
            ->setItemName($product?->getTitle() ?? __('Ticket'))
            ->setQuantity(self::SAMPLE_QUANTITY)
            ->setPrice($unitPrice)
            ->setTotalGross($unitPrice * self::SAMPLE_QUANTITY);
    }

    private function sampleOrder(EventDomainObject $event, OrderItemDomainObject $orderItem): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setEventId($event->getId())
            ->setShortId('o_sample')
            ->setPublicId('O-SAMPLE')
            ->setFirstName(self::SAMPLE_FIRST_NAME)
            ->setLastName(self::SAMPLE_LAST_NAME)
            ->setEmail(self::SAMPLE_EMAIL)
            ->setTotalGross($orderItem->getTotalGross())
            ->setCurrency($event->getCurrency())
            ->setLocale(app()->getLocale())
            ->setCreatedAt(Carbon::now()->toDateTimeString())
            ->setStatus(OrderStatus::COMPLETED->name)
            ->setPaymentStatus(OrderPaymentStatus::PAYMENT_RECEIVED->name)
            ->setPaymentProvider(PaymentProviders::STRIPE->value)
            ->setDepositAmount(0)
            ->setOrderItems(collect([$orderItem]));
    }

    private function sampleAttendee(OrderItemDomainObject $orderItem): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())
            ->setShortId('a_sample')
            ->setPublicId('A-SAMPLE')
            ->setFirstName(self::SAMPLE_FIRST_NAME)
            ->setLastName(self::SAMPLE_LAST_NAME)
            ->setEmail(self::SAMPLE_EMAIL)
            ->setProductPriceId($orderItem->getProductPriceId());
    }
}
