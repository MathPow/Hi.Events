@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string $eventUrl */ @endphp
@php /** @see \HiEvents\Mail\Order\OrderFailed */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('Order not completed') }}

{{ $order->getFirstName() ? __('Hello :name,', ['name' => $order->getFirstName()]) : __('Hello,') }}

{{ __('Your order for :event could not be completed. You can try again from the event page.', ['event' => $event->getTitle()]) }}

<x-mail::button :url="$eventUrl">
{{ __('Try again') }}
</x-mail::button>

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
