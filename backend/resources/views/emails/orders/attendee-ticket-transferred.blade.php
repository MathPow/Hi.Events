@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string $ticketTitle */ @endphp
@php /** @var string $previousHolderName */ @endphp
@php /** @var string $newHolderName */ @endphp
@php /** @var bool $toBuyer */ @endphp
@php /** @see \HiEvents\Mail\Attendee\AttendeeTicketTransferredMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('Ticket transferred') }}

{{ __('Hello,') }}

@if($toBuyer)
{{ __('The ticket of :previousHolder for **:eventName** from your order has been transferred to **:newHolder**', ['previousHolder' => $previousHolderName, 'eventName' => $event->getTitle(), 'newHolder' => $newHolderName]) }}
@else
{{ __('Your ticket for **:eventName** has been transferred to **:newHolder**', ['eventName' => $event->getTitle(), 'newHolder' => $newHolderName]) }}
@endif

**{{ __('Ticket') }}**: {{ $ticketTitle }}

{{ __('The new participant received the ticket by email. The previous ticket and its QR code no longer work.') }}

{{ __('If you did not make this change, please contact the event organizer immediately.') }}

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
