@php /** @var string $organizerName */ @endphp
@php /** @var string $senderName */ @endphp
@php /** @var string $reply */ @endphp
@php /** @var string $originalMessage */ @endphp

@php /** @see \HiEvents\Mail\Organizer\OrganizerContactReplyEmail */ @endphp

<x-mail::message>
{{ __('Hello :name', ['name' => $senderName]) }},

{!! nl2br(e($reply)) !!}

**{{ $organizerName }}**

<div style="border-radius: 12px; background-color: #fff7e9; margin: 16px 0 10px; padding: 16px 20px; font-size: 14px;">
<div style="font-weight: bold; margin-bottom: 6px;">{{ __('Your message') }}</div>
{!! nl2br(e($originalMessage)) !!}
</div>

{{ __('To answer, simply reply to this email: your reply goes to :organizerName.', ['organizerName' => $organizerName]) }}
</x-mail::message>
