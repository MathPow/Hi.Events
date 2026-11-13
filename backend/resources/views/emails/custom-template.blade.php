{{-- The organizer's own version of the order confirmation or the ticket (Liquid), in the event's look. --}}
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
<x-mail::event-message :branding="$branding" :footer="$eventSettings->getGetEmailFooterHtml()">
{!! $renderedBody !!}

@foreach($signatureLinks ?? [] as $link)
<x-mail::button :url="$link['url']">
{{ __('Sign for :name', ['name' => $link['name']]) }}
</x-mail::button>
@endforeach

@foreach($routeFiles ?? [] as $routeFile)
<x-mail::button :url="$routeFile->getDownloadUrl()">
{{ __('Download the route · :label', ['label' => $routeFile->getLabel()]) }}
</x-mail::button>
@endforeach

@if(isset($renderedCta))
<x-mail::button :url="$renderedCta['url']">
{{ $renderedCta['label'] }}
</x-mail::button>
@endif
</x-mail::event-message>
