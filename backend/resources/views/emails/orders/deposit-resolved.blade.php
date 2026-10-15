@php use HiEvents\Helper\Currency; @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var float $deposit */ @endphp
@php /** @var float $retained */ @endphp
@php /** @var float $returned */ @endphp

@php /** @see \HiEvents\Mail\Order\OrderDepositResolved */ @endphp

<x-mail::message>
{{ __('Hello') }} {{ $order->getFirstName() }},

@if($retained <= 0)
{{ __('Your security deposit of :deposit for :eventTitle is being returned to you in full.', ['deposit' => Currency::format($deposit, $event->getCurrency()), 'eventTitle' => $event->getTitle()]) }}
@elseif($returned <= 0)
{{ __('Your security deposit of :deposit for :eventTitle has been retained.', ['deposit' => Currency::format($deposit, $event->getCurrency()), 'eventTitle' => $event->getTitle()]) }}
@else
{{ __('Of your security deposit of :deposit for :eventTitle, :retained has been retained. The remaining :returned is being returned to you.', ['deposit' => Currency::format($deposit, $event->getCurrency()), 'eventTitle' => $event->getTitle(), 'retained' => Currency::format($retained, $event->getCurrency()), 'returned' => Currency::format($returned, $event->getCurrency())]) }}
@endif

@if($retained > 0 && $order->getDepositNote())
**{{ __('Reason:') }}** {{ $order->getDepositNote() }}
@endif

- **{{ __('Order Number:') }}** {{ $order->getPublicId() }}

{{ __('If you have any questions or need assistance, please contact') }} <a href="mailto:{{ $eventSettings->getSupportEmail() ?: $organizer->getEmail() }}">{{ $eventSettings->getSupportEmail() ?: $organizer->getEmail() }}</a>.

{{ __('Best regards,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}

{!! $eventSettings->getGetEmailFooterHtml() !!}
</x-mail::message>
