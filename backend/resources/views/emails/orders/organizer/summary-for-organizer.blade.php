@php use HiEvents\Helper\Currency @endphp

@php /** @uses /backend/app/Mail/OrderSummary.php */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp

<x-mail::message>
# {{ __('You\'ve received a new order!') }} 🎉

{{ __('Congratulations! You\'ve received a new order for **:event**. Please find the details below.', ['event' => $event->getTitle()]) }}

@if($order->isOrderAwaitingOfflinePayment())
<div style="border-radius: 8px; background-color: #fdf1e6; color: #6b3a14; margin-bottom: 1.5rem; padding: 1rem;">
<p>
{{ __('ℹ️ This order is pending payment. Please mark the payment as received on the order management page once payment is received.') }}
</p>
</div>
@endif

{{ __('Name:') }} <b>{{ $order->getFullName() }}</b><br>
{{ __('Email:') }} <b>{{ $order->getEmail() }}</b><br>
{{ __('Order Amount:') }} <b>{{ Currency::format($order->getTotalGross(), $event->getCurrency()) }}</b><br>
{{ __('Order ID:') }} <b>{{ $order->getPublicId() }}</b><br>
{{ __('Order Status:') }} <b>{{ $order->getHumanReadableStatus() }}</b>
<br>

<x-mail::button :url="$orderUrl">
    {{ __('View Order') }}
</x-mail::button>

</x-mail::message>
