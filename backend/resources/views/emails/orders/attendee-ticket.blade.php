@php use HiEvents\DomainObjects\AttendeeDomainObject; @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\AttendeeDomainObject $attendee */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var \Illuminate\Support\Collection $tickets */ @endphp
@php /** @see \HiEvents\Mail\Attendee\AttendeeTicketMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ trans_choice('{1} Your ticket|[2,*] Your :count tickets', $tickets->count(), ['count' => $tickets->count()]) }}

{{ $attendee->getFirstName() ? __('Hello :name,', ['name' => $attendee->getFirstName()]) : __('Hello,') }}

@if($order->isOrderAwaitingOfflinePayment())
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px; background-color: {{ $branding->accentSoftColor }}; border-radius: 16px; border-collapse: separate;"><tr><td style="padding: 16px 20px; font-size: 15px; color: #352924;">
{{ __('Your order is pending payment. Tickets have been issued but will not be valid until payment is received.') }}
</td></tr></table>
@endif

{{ trans_choice('{1} Show this QR code at the entrance. It is also attached to this email as a PDF.|[2,*] Show these QR codes at the entrance. They are also attached to this email as a PDF.', $tickets->count()) }}

@foreach($tickets as $ticket)
@php /** @var AttendeeDomainObject $ticketAttendee */ @endphp
@php $ticketAttendee = $ticket['attendee']; @endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; margin: 20px 0; background-color: #ffffff; border: 1px solid #f1dccd; border-radius: 18px; border-collapse: separate;"><tr><td style="padding: 22px 20px; text-align: center;">
<div style="font-size: 17px; font-weight: bold; color: #352924;">{{ $ticketAttendee->getFullName() }}</div>
<div style="margin: 16px 0;"><img src="{{ $message->embedData($ticket['qrCode'], $ticketAttendee->getPublicId() . '.png', 'image/png') }}" alt="{{ $ticketAttendee->getPublicId() }}" width="180" height="180" style="display: block; margin: 0 auto; width: 180px; height: 180px;"></div>
<div style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(53, 41, 36, 0.6);">{{ __('Ticket ID') }}</div>
<div style="font-family: monospace; font-size: 15px; font-weight: bold; letter-spacing: 1px; color: #352924;">{{ $ticketAttendee->getPublicId() }}</div>
@if($ticket['signUrl'])
<div style="margin-top: 16px; padding: 12px 14px; background-color: #fbf0e4; border-radius: 12px; font-size: 14px; color: #352924;">{{ __('Before the event, :name has to sign online (waiver and documents). It takes a minute.', ['name' => $ticketAttendee->getFirstName() ?: $ticketAttendee->getFullName()]) }}</div>
<div style="margin-top: 12px;"><a href="{{ $ticket['signUrl'] }}" style="display: inline-block; padding: 12px 22px; border-radius: 999px; background-color: {{ $branding->accentDeepColor }}; color: #ffffff; font-size: 15px; font-weight: bold; text-decoration: none;">{{ __('Sign now') }}</a></div>
@endif
<div style="margin-top: 14px;"><a href="{{ $ticket['ticketUrl'] }}" style="font-size: 14px; font-weight: bold; color: {{ $branding->accentDeepColor }};">{{ __('View this ticket online') }}</a></div>
</td></tr></table>
@endforeach

{{ __('Each QR code can only be scanned once, so please do not share it.') }}

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
