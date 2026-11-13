@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var string $amount */ @endphp
@php /** @var string $orderUrl */ @endphp
@php /** @see \HiEvents\Mail\EventChange\ManualRefundRequiredMail */ @endphp
<x-mail::message>
# {{ __('A refund to make by hand') }}

{{ __(':name can no longer come to :event on its new date and cancelled their order. It was not paid online: refund it yourself, the way it was paid.', ['name' => $order->getFullName(), 'event' => $event->getTitle()]) }}

{{ __('Name:') }} <b>{{ $order->getFullName() }}</b><br>
{{ __('Email:') }} <b>{{ $order->getEmail() }}</b><br>
{{ __('Order ID:') }} <b>{{ $order->getPublicId() }}</b><br>
{{ __('Amount to refund:') }} <b>{{ $amount }}</b>

<x-mail::button :url="$orderUrl">
{{ __('View Order') }}
</x-mail::button>
</x-mail::message>
