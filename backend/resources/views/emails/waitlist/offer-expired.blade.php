@php /** @var \HiEvents\DomainObjects\WaitlistEntryDomainObject $entry */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string|null $productName */ @endphp
@php /** @var string $eventUrl */ @endphp
@php /** @see \HiEvents\Mail\Waitlist\WaitlistOfferExpiredMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('Your waitlist offer has expired') }}

{{ $entry->getFirstName() ? __('Hello :name,', ['name' => $entry->getFirstName()]) : __('Hello,') }}

@if($productName)
{{ __('Unfortunately, your waitlist offer for **:product** for the event **:event** has expired.', ['product' => $productName, 'event' => $event->getTitle()]) }}
@else
{{ __('Unfortunately, your waitlist offer for the event **:event** has expired.', ['event' => $event->getTitle()]) }}
@endif

{{ __('If you are still interested, you may rejoin the waitlist from the event page.') }}

<x-mail::button :url="$eventUrl">
{{ __('View Event') }}
</x-mail::button>

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
