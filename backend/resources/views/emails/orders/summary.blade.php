@php use HiEvents\Helper\Currency; @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string $orderUrl */ @endphp
@php /** @see \HiEvents\Mail\Order\OrderSummary */ @endphp
@php
    $cell = 'padding: 11px 0; border-bottom: 1px solid #f1dccd; font-size: 15px; color: #352924;';
    $items = $order->getOrderItems() ?? collect();
@endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('Your order is confirmed') }}

{{ $order->getFirstName() ? __('Hello :name,', ['name' => $order->getFirstName()]) : __('Hello,') }}

@if($order->isOrderAwaitingOfflinePayment())
{{ __('Your order is pending payment. Tickets have been issued but will not be valid until payment is received.') }}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background-color: {{ $branding->accentSoftColor }}; border-radius: 16px; border-collapse: separate;"><tr><td style="padding: 16px 20px; font-size: 15px; color: #352924;">
<strong>{{ __('Payment Instructions') }}</strong><br>
{!! $eventSettings->getOfflinePaymentInstructions() !!}
</td></tr></table>
@else
{{ __('Thank you for your order! Here is the summary.') }}
@endif

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 24px; border-collapse: collapse;">
<tr><td style="{{ $cell }} color: rgba(53, 41, 36, 0.7);">{{ __('Order number') }}</td><td align="right" style="{{ $cell }} font-weight: bold;">{{ $order->getPublicId() }}</td></tr>
@foreach($items as $item)
<tr><td style="{{ $cell }}">{{ $item->getItemName() }} × {{ $item->getQuantity() }}</td><td align="right" style="{{ $cell }}">{{ Currency::format($item->getTotalGross() ?? ($item->getPrice() * $item->getQuantity()), $event->getCurrency()) }}</td></tr>
@endforeach
<tr><td style="{{ $cell }} border-bottom: 0; font-weight: bold;">{{ __('Total') }}</td><td align="right" style="{{ $cell }} border-bottom: 0; font-weight: bold;">{{ Currency::format($order->getTotalGross(), $event->getCurrency()) }}</td></tr>
</table>

@if($order->getDepositAmount() > 0)
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background-color: {{ $branding->accentSoftColor }}; border-radius: 16px; border-collapse: separate;"><tr><td style="padding: 16px 20px; font-size: 15px; color: #352924;">
<strong>{{ __('Security Deposit') }}</strong><br>
{{ __('A security deposit of :amount must be sent separately. It is not included in the total above.', ['amount' => Currency::format($order->getDepositAmount(), $event->getCurrency())]) }}
{!! $eventSettings->getDepositInstructions() !!}
</td></tr></table>
@endif

@if($eventSettings->getPostCheckoutMessage() && $order->isOrderCompleted())
## {{ __('Additional Information') }}

{!! $eventSettings->getPostCheckoutMessage() !!}
@endif

<x-mail::button :url="$orderUrl">
{{ __('View Order Summary & Tickets') }}
</x-mail::button>

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
