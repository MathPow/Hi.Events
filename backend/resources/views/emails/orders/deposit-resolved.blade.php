@php use HiEvents\Helper\Currency; @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var float $deposit */ @endphp
@php /** @var float $retained */ @endphp
@php /** @var float $returned */ @endphp
@php /** @see \HiEvents\Mail\Order\OrderDepositResolved */ @endphp
@php $money = fn(float $amount) => Currency::format($amount, $event->getCurrency()); @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('Your security deposit') }}

{{ $order->getFirstName() ? __('Hello :name,', ['name' => $order->getFirstName()]) : __('Hello,') }}

@if($retained <= 0)
{{ __('Your security deposit of :deposit for :eventTitle is being returned to you in full.', ['deposit' => $money($deposit), 'eventTitle' => $event->getTitle()]) }}
@elseif($returned <= 0)
{{ __('Your security deposit of :deposit for :eventTitle has been retained.', ['deposit' => $money($deposit), 'eventTitle' => $event->getTitle()]) }}
@else
{{ __('Of your security deposit of :deposit for :eventTitle, :retained has been retained. The remaining :returned is being returned to you.', ['deposit' => $money($deposit), 'eventTitle' => $event->getTitle(), 'retained' => $money($retained), 'returned' => $money($returned)]) }}
@endif

@if($retained > 0 && $order->getDepositNote())
**{{ __('Reason:') }}** {{ $order->getDepositNote() }}
@endif

**{{ __('Order Number:') }}** {{ $order->getPublicId() }}

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
