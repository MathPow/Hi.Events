{{-- The organizer's own version of the order confirmation or the ticket (Liquid), in the event's look. --}}
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
<x-mail::event-message :branding="$branding" :footer="$eventSettings->getGetEmailFooterHtml()">
{!! $renderedBody !!}

@if(isset($renderedCta))
<x-mail::button :url="$renderedCta['url']">
{{ $renderedCta['label'] }}
</x-mail::button>
@endif
</x-mail::event-message>
