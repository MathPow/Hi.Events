<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Email;

use Carbon\Carbon;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EmailTemplateDomainObject;
use HiEvents\DomainObjects\Enums\AutomaticEmailType;
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
use HiEvents\DomainObjects\WaitlistEntryDomainObject;
use HiEvents\Mail\Attendee\AttendeeDetailsChangedMail;
use HiEvents\Mail\BaseMail;
use HiEvents\Mail\Attendee\AttendeeTicketMail;
use HiEvents\Mail\Order\OrderCancelled;
use HiEvents\Mail\Order\OrderDepositResolved;
use HiEvents\Mail\Order\OrderDetailsChangedMail;
use HiEvents\Mail\Order\OrderFailed;
use HiEvents\Mail\Order\OrderRefunded;
use HiEvents\Mail\Order\OrderSummary;
use HiEvents\Mail\Order\PaymentSuccessButOrderExpiredMail;
use HiEvents\Mail\Organizer\OrderSummaryForOrganizer;
use HiEvents\Mail\Organizer\OrganizerContactEmail;
use HiEvents\Mail\Waitlist\WaitlistConfirmationMail;
use HiEvents\Mail\Waitlist\WaitlistOfferExpiredMail;
use HiEvents\Mail\Waitlist\WaitlistOfferMail;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Values\MoneyValue;

/**
 * The automatic emails of an organizer, as they would be sent, for the preview and the test send of
 * Settings → Emails. The organizer's latest event provides the event details; the buyer is made up.
 * The order confirmation and the ticket show the organizer's own version (not an event's); the
 * other emails take the organizer's subject and message like when they are sent.
 */
class SampleEmailService
{
    public const SAMPLE_FIRST_NAME = 'Marie';
    public const SAMPLE_LAST_NAME = 'Tremblay';
    public const SAMPLE_EMAIL = 'marie.tremblay@example.com';
    public const SAMPLE_NEW_EMAIL = 'marie@example.com';

    private const SAMPLE_QUANTITY = 2;
    private const SAMPLE_TICKET_PRICE = 35.0;
    private const SAMPLE_PRODUCT_PRICE_ID = -1;
    private const SAMPLE_DEPOSIT = 50.0;

    public function __construct(
        private readonly EventRepositoryInterface   $eventRepository,
        private readonly ProductRepositoryInterface $productRepository,
        private readonly EmailTemplateService       $emailTemplateService,
        private readonly EmailTokenContextBuilder   $tokenContextBuilder,
    )
    {
    }

    public function buildMail(AutomaticEmailType $type, OrganizerDomainObject $organizer): BaseMail
    {
        $event = $this->sampleEvent($organizer);
        $eventSettings = $event->getEventSettings() ?? $this->sampleEventSettings($organizer);
        $orderItem = $this->sampleOrderItem($event);
        $order = $this->sampleOrder($event, $orderItem);
        $attendee = $this->sampleAttendee($orderItem);
        $currency = $event->getCurrency() ?: 'CAD';

        return match ($type) {
            AutomaticEmailType::ORDER_CONFIRMATION => $this->orderConfirmation($organizer, $event, $eventSettings, $order),
            AutomaticEmailType::ATTENDEE_TICKET => $this->attendeeTicket($organizer, $event, $eventSettings, $order, $attendee),
            AutomaticEmailType::ORDER_FAILED => new OrderFailed($order, $event, $organizer, $eventSettings),
            AutomaticEmailType::PAYMENT_AFTER_EXPIRY => new PaymentSuccessButOrderExpiredMail($order, $event, $eventSettings, $organizer),
            AutomaticEmailType::ORDER_CANCELLED => new OrderCancelled($order, $event, $organizer, $eventSettings),
            AutomaticEmailType::ORDER_REFUNDED => new OrderRefunded(
                $order, $event, $organizer, $eventSettings, MoneyValue::fromFloat($order->getTotalGross(), $currency),
            ),
            AutomaticEmailType::DEPOSIT_RESOLVED => new OrderDepositResolved(
                $order->setDepositAmount(self::SAMPLE_DEPOSIT)->setDepositRetainedAmount(0.0),
                $event, $organizer, $eventSettings,
            ),
            AutomaticEmailType::ORDER_DETAILS_CHANGED => new OrderDetailsChangedMail($event, $organizer, $eventSettings, [
                __('Email') => ['old' => self::SAMPLE_EMAIL, 'new' => self::SAMPLE_NEW_EMAIL],
            ]),
            AutomaticEmailType::ATTENDEE_DETAILS_CHANGED => new AttendeeDetailsChangedMail(
                $orderItem->getItemName(), $event, $organizer, $eventSettings, [
                    __('Email') => ['old' => self::SAMPLE_EMAIL, 'new' => self::SAMPLE_NEW_EMAIL],
                ],
            ),
            AutomaticEmailType::WAITLIST_JOINED => new WaitlistConfirmationMail(
                $this->sampleWaitlistEntry($event), $event, $this->sampleProduct($orderItem), null, $organizer, $eventSettings,
            ),
            AutomaticEmailType::WAITLIST_OFFER => new WaitlistOfferMail(
                $this->sampleWaitlistEntry($event, offered: true), $event, $this->sampleProduct($orderItem), null,
                $organizer, $eventSettings, $order->getShortId(), 'sample',
            ),
            AutomaticEmailType::WAITLIST_OFFER_EXPIRED => new WaitlistOfferExpiredMail(
                $this->sampleWaitlistEntry($event), $event, $this->sampleProduct($orderItem), null, $organizer, $eventSettings,
            ),
            AutomaticEmailType::ORGANIZER_NEW_ORDER => new OrderSummaryForOrganizer($order->setId(0), $event),
            AutomaticEmailType::ORGANIZER_CONTACT_MESSAGE => new OrganizerContactEmail(
                $organizer,
                self::SAMPLE_FIRST_NAME . ' ' . self::SAMPLE_LAST_NAME,
                self::SAMPLE_EMAIL,
                __('Hello! Is the outing suitable for beginners? Thank you!'),
            ),
        };
    }

    private function orderConfirmation(
        OrganizerDomainObject    $organizer,
        EventDomainObject        $event,
        EventSettingDomainObject $eventSettings,
        OrderDomainObject        $order,
    ): OrderSummary
    {
        $template = $this->organizerTemplate(EmailTemplateType::ORDER_CONFIRMATION, $organizer);

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

    private function attendeeTicket(
        OrganizerDomainObject    $organizer,
        EventDomainObject        $event,
        EventSettingDomainObject $eventSettings,
        OrderDomainObject        $order,
        AttendeeDomainObject     $attendee,
    ): AttendeeTicketMail
    {
        $template = $this->organizerTemplate(EmailTemplateType::ATTENDEE_TICKET, $organizer);

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

    private function organizerTemplate(EmailTemplateType $type, OrganizerDomainObject $organizer): ?EmailTemplateDomainObject
    {
        return $this->emailTemplateService->getTemplateByType(
            type: $type,
            accountId: $organizer->getAccountId(),
            organizerId: $organizer->getId(),
        );
    }

    private function sampleProduct(OrderItemDomainObject $orderItem): ProductDomainObject
    {
        return (new ProductDomainObject())->setTitle($orderItem->getItemName());
    }

    private function sampleWaitlistEntry(EventDomainObject $event, bool $offered = false): WaitlistEntryDomainObject
    {
        $entry = (new WaitlistEntryDomainObject())
            ->setEventId($event->getId())
            ->setFirstName(self::SAMPLE_FIRST_NAME)
            ->setLastName(self::SAMPLE_LAST_NAME)
            ->setEmail(self::SAMPLE_EMAIL);

        if ($offered) {
            $entry->setOfferExpiresAt(Carbon::now('UTC')->addDay()->startOfHour()->toDateTimeString());
        }

        return $entry;
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
            ->setId(0)
            ->setShortId('a_sample')
            ->setPublicId('A-SAMPLE')
            ->setFirstName(self::SAMPLE_FIRST_NAME)
            ->setLastName(self::SAMPLE_LAST_NAME)
            ->setEmail(self::SAMPLE_EMAIL)
            ->setProductPriceId($orderItem->getProductPriceId());
    }
}
