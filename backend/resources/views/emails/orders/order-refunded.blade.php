@php use HiEvents\Helper\Currency; @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Values\MoneyValue $refundAmount */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @see \HiEvents\Mail\Order\OrderRefunded */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('Refund issued') }}

{{ $order->getFirstName() ? __('Hello :name,', ['name' => $order->getFirstName()]) : __('Hello,') }}

{{ __('We have refunded :amount for your order :number.', ['amount' => Currency::format($refundAmount->toFloat(), $event->getCurrency()), 'number' => $order->getPublicId()]) }}

{{ __('The money can take 5 to 10 business days to appear on your statement, depending on your bank.') }}

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
