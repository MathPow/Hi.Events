@php /** @var \HiEvents\DomainObjects\WaitlistEntryDomainObject $entry */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string|null $productName */ @endphp
@php /** @var string $eventUrl */ @endphp
@php /** @see \HiEvents\Mail\Waitlist\WaitlistConfirmationMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __("You're on the waitlist!") }}

{{ $entry->getFirstName() ? __('Hello :name,', ['name' => $entry->getFirstName()]) : __('Hello,') }}

@if($productName)
{{ __('You are on the waitlist for **:product**.', ['product' => $productName]) }}
@else
{{ __('You are on the waitlist for this event.') }}
@endif

{{ __("We'll notify you as soon as a spot becomes available.") }}

<x-mail::button :url="$eventUrl">
{{ __('View Event') }}
</x-mail::button>

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
