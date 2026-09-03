@php use HiEvents\DomainObjects\AttendeeDomainObject; @endphp
@php /** @uses \HiEvents\Mail\Order\OrderSummary */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\AttendeeDomainObject $attendee */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp

@php /** @var string $ticketUrl */ @endphp
@php /** @var \Illuminate\Support\Collection $tickets */ @endphp
@php /** @see \HiEvents\Mail\Attendee\AttendeeTicketMail */ @endphp

<x-mail::message>
# {{ __('You\'re going to') }} {{ $event->getTitle() }}! 🎉
<br>
<br>
@if($order->isOrderAwaitingOfflinePayment())
<div style="border-radius: 4px; background-color: #f8d7da; color: #842029; margin-bottom: 1.5rem; padding: 1rem;">
<p>
{{ __('ℹ️ Your order is pending payment. Tickets have been issued but will not be valid until payment is received.') }}
</p>
</div>
@endif

{{ trans_choice('{1} Your ticket is below, and also attached to this email as a PDF.|[2,*] Your :count tickets are below, and also attached to this email as a PDF.', $tickets->count(), ['count' => $tickets->count()]) }}

@foreach($tickets as $ticket)
@php /** @var AttendeeDomainObject $ticketAttendee */ @endphp
@php $ticketAttendee = $ticket['attendee']; @endphp

<table style="width: 100%; margin: 24px 0; border: 1px solid #e8e5ef; border-radius: 6px;" cellpadding="0" cellspacing="0">
<tr>
<td style="padding: 20px; text-align: center;">
<div style="font-size: 16px; font-weight: 700; color: #1a1a1a;">{{ $ticketAttendee->getFullName() }}</div>
<div style="margin: 16px 0;">
<img src="{{ $message->embedData($ticket['qrCode'], $ticketAttendee->getPublicId() . '.png', 'image/png') }}"
alt="{{ $ticketAttendee->getPublicId() }}"
width="180" height="180"
style="display: block; margin: 0 auto; width: 180px; height: 180px;">
</div>
<div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #888;">{{ __('Ticket ID') }}</div>
<div style="font-family: monospace; font-size: 14px; font-weight: 700; letter-spacing: 1px; color: #1a1a1a;">{{ $ticketAttendee->getPublicId() }}</div>
<div style="margin-top: 14px;">
<a href="{{ $ticket['ticketUrl'] }}" style="font-size: 13px; color: #4a3bbd;">{{ __('View this ticket online') }}</a>
</div>
</td>
</tr>
</table>

@endforeach

{{ __('Each QR code can only be scanned once, so please do not share it.') }}

{{ __('If you have any questions or need assistance, please reply to this email or contact the event organizer') }}
{{ __('at') }} <a href="mailto:{{$eventSettings->getSupportEmail()}}">{{$eventSettings->getSupportEmail()}}</a>.

{{ __('Best regards,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}

</x-mail::message>
