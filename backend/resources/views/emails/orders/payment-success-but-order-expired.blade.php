@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @see \HiEvents\Mail\Order\PaymentSuccessButOrderExpiredMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('Your payment was refunded') }}

{{ $order->getFirstName() ? __('Hello :name,', ['name' => $order->getFirstName()]) : __('Hello,') }}

{{ __('Your recent order for :eventTitle was not successful. The order expired while you were completing the payment. We have issued a refund for the order.', ['eventTitle' => $event->getTitle()]) }}

{{ __('We apologize for the inconvenience. You can place a new order from the event page.') }}

<x-mail::button :url="$event->getEventUrl()">
{{ __('View Event Page') }}
</x-mail::button>

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
