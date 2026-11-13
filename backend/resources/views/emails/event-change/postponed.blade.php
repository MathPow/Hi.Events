@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php /** @var string $organizerMessage */ @endphp
@php /** @var string|null $firstName */ @endphp
@php /** @var string $newDate */ @endphp
@php /** @var string|null $refundUrl */ @endphp
@php /** @var string|null $refundDeadline */ @endphp
@php /** @var string $eventUrl */ @endphp
@php /** @var string $organizerName */ @endphp
@php /** @see \HiEvents\Mail\EventChange\EventPostponedMail */ @endphp
<x-mail::event-message :branding="$branding" :note="$organizerMessage" :footer="$eventSettings->getGetEmailFooterHtml()">
# {{ __('The event is postponed') }}

{{ $firstName ? __('Hello :name,', ['name' => $firstName]) : __('Hello,') }}

{{ __(':event will take place on a new date:', ['event' => $event->getTitle()]) }}

**{{ $newDate }}**

{{ __('Your tickets stay valid for the new date: you have nothing to do.') }}

@if($refundUrl)
{{ __('If you can no longer come, you can cancel your order and get a full refund.') }}
@if($refundDeadline)
{{ __('You have until :date to ask.', ['date' => $refundDeadline]) }}
@endif

<x-mail::button :url="$refundUrl">
{{ __('I can no longer come: refund me') }}
</x-mail::button>
@else
<x-mail::button :url="$eventUrl">
{{ __('View Event Page') }}
</x-mail::button>
@endif

{{ __('See you soon,') }}<br>
{{ $organizerName }}
</x-mail::event-message>
