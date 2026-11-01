@props(['branding', 'note' => null, 'footer' => null])
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@if($branding->organizerName)
{{ $branding->organizerName }}
@endif
{{ mb_strtoupper($branding->eventTitle) }}
@if($branding->dateLine)
{{ $branding->dateLine }}@if($branding->timezoneLine) ({{ $branding->timezoneLine }})@endif

@endif
@if($branding->placeLine)
{{ $branding->placeLine }}@if($branding->addressLine), {{ $branding->addressLine }}@endif

@endif

@if($note)
{{ __('A word from :organizer', ['organizer' => $branding->organizerName ?: __('the organizer')]) }}
{{ html_entity_decode(trim(strip_tags(str_replace(['</p>', '<br>', '<br/>', '<br />'], "\n", $note))), ENT_QUOTES, 'UTF-8') }}

@endif
{{ $slot }}
@if($footer)

{{ html_entity_decode(trim(strip_tags($footer)), ENT_QUOTES, 'UTF-8') }}
@endif

@if($branding->supportEmail)
{{ __('Questions? Write to :organizer:', ['organizer' => $branding->organizerName ?: __('the organizer')]) }} {{ $branding->supportEmail }}
@endif
