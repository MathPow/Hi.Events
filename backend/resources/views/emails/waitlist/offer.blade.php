@php /** @var \HiEvents\DomainObjects\WaitlistEntryDomainObject $entry */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string|null $productName */ @endphp
@php /** @var string|null $offerExpiresAtFormatted */ @endphp
@php /** @var string $checkoutUrl */ @endphp
@php /** @see \HiEvents\Mail\Waitlist\WaitlistOfferMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('A spot has opened up!') }}

{{ $entry->getFirstName() ? __('Hello :name,', ['name' => $entry->getFirstName()]) : __('Hello,') }}

@if($productName)
{{ __('Great news! A spot has become available for **:product** for the event **:event**.', ['product' => $productName, 'event' => $event->getTitle()]) }}
@else
{{ __('Great news! A spot has become available for the event **:event**.', ['event' => $event->getTitle()]) }}
@endif

{{ __('An order has been reserved for you. Click the button below to complete your purchase.') }}

@if($offerExpiresAtFormatted)
**{{ __('This offer expires on :date. Please complete your order before it expires.', ['date' => $offerExpiresAtFormatted]) }}**
@endif

<x-mail::button :url="$checkoutUrl">
{{ __('Complete Your Order') }}
</x-mail::button>

{{ __('See you soon,') }}<br>
{{ $organizer->getName() ?: config('app.name') }}
</x-mail::event-message>
