@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string $organizerMessage */ @endphp
@php /** @var string|null $firstName */ @endphp
@php /** @var string|null $refundLine */ @endphp
@php /** @var string $organizerName */ @endphp
@php /** @see \HiEvents\Mail\EventChange\EventCancelledMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('The event is cancelled') }}

{{ $firstName ? __('Hello :name,', ['name' => $firstName]) : __('Hello,') }}

{{ __(':event will not take place. Your tickets are no longer valid.', ['event' => $event->getTitle()]) }}

@if($refundLine)
**{{ $refundLine }}**
@endif

{{ __('If you have a question, simply reply to this email.') }}

{{ __('See you soon,') }}<br>
{{ $organizerName }}
</x-mail::event-message>
