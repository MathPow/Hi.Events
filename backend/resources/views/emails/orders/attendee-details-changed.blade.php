@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string $ticketTitle */ @endphp
@php /** @var array $changedFields */ @endphp
@php /** @see \HiEvents\Mail\Attendee\AttendeeDetailsChangedMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('Ticket updated') }}

{{ __('Hello,') }}

{{ __('The details on your ticket for **:eventName** have been updated.', ['eventName' => $event->getTitle()]) }}

**{{ __('Ticket') }}**: {{ $ticketTitle }}

## {{ __('What Changed') }}

@foreach($changedFields as $field => $change)
- **{{ $field }}**: {{ $change['old'] }} → {{ $change['new'] }}
@endforeach

{{ __('If you did not make this change, please contact the event organizer immediately.') }}

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
