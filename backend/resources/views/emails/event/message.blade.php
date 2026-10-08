@php use Carbon\Carbon; use HiEvents\Helper\DateHelper; @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Application\Handlers\Message\DTO\SendMessageDTO $messageData */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp

@php /** @see \HiEvents\Mail\Event\EventMessage */ @endphp

@php
    $eventDate = $event->getStartDate()
        ? Carbon::parse(DateHelper::convertFromUTC($event->getStartDate(), $event->getTimezone()))
            ->locale(app()->getLocale())
            ->isoFormat('LL')
        : null;
    $font = $branding->fontFamily;
    $text = '#1f1a33';
    $muted = '#6b6680';
@endphp
<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>{{ $messageData->subject }}</title>
    @if($branding->fontStylesheetUrl)
        <link href="{{ $branding->fontStylesheetUrl }}" rel="stylesheet">
    @endif
    <style>
        .message-body p { margin: 0 0 1em; }
        .message-body a, .footer-message a { color: {{ $branding->accentColor }}; }
        .message-body img { max-width: 100%; height: auto; }
        @media only screen and (max-width: 620px) {
            .card-pad { padding-left: 22px !important; padding-right: 22px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: {{ $branding->backgroundColor }}; -webkit-text-size-adjust: 100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color: {{ $branding->backgroundColor }};">
    <tr>
        <td align="center" style="padding: 32px 12px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
                   style="width: 100%; max-width: 600px; font-family: {{ $font }};">

                <tr>
                    <td align="center"
                        style="background-color: {{ $branding->accentColor }}; border-radius: 16px 16px 0 0; padding: 28px 24px;">
                        @if($branding->organizerLogoUrl)
                            <img src="{{ $branding->organizerLogoUrl }}" width="104" height="104"
                                 alt="{{ $branding->organizerName }}"
                                 style="display: block; width: 104px; height: 104px; border-radius: 16px; border: 0;">
                        @elseif($branding->organizerName)
                            <span style="color: {{ $branding->accentTextColor }}; font-size: 20px; font-weight: 700; letter-spacing: .02em;">
                                {{ $branding->organizerName }}
                            </span>
                        @endif
                    </td>
                </tr>

                @if($branding->eventCoverUrl)
                    <tr>
                        <td style="background-color: #ffffff; line-height: 0; font-size: 0;">
                            <img src="{{ $branding->eventCoverUrl }}" width="600" alt="{{ $event->getTitle() }}"
                                 style="display: block; width: 100%; max-width: 600px; height: auto; border: 0;">
                        </td>
                    </tr>
                @endif

                <tr>
                    <td class="card-pad" style="background-color: #ffffff; padding: 32px 40px 8px;">
                        <p style="margin: 0 0 6px; color: {{ $branding->accentColor }}; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;">
                            {{ $event->getTitle() }}
                        </p>
                        @if($eventDate)
                            <p style="margin: 0; color: {{ $muted }}; font-size: 13px;">{{ $eventDate }}</p>
                        @endif
                        <div style="width: 48px; height: 3px; background-color: {{ $branding->accentColor }}; margin: 20px 0 24px; font-size: 0; line-height: 0;">&nbsp;</div>
                        <div class="message-body" style="color: {{ $text }}; font-size: 16px; line-height: 1.6;">
                            {!! $messageData->message !!}
                        </div>
                    </td>
                </tr>

                @if($eventSettings->getGetEmailFooterHtml())
                    <tr>
                        <td class="card-pad" style="background-color: #ffffff; padding: 8px 40px 0;">
                            <div class="footer-message"
                                 style="border-top: 1px solid #ece9f2; padding-top: 8px; color: #4a4560; font-size: 14px; line-height: 1.5;">
                                {!! $eventSettings->getGetEmailFooterHtml() !!}
                            </div>
                        </td>
                    </tr>
                @endif

                <tr>
                    <td class="card-pad"
                        style="background-color: #ffffff; border-radius: 0 0 16px 16px; padding: 16px 40px 32px; color: #8a8597; font-size: 12px; line-height: 1.5;">
                        {{ __('You are receiving this communication because you are registered as an attendee for the following event:') }}
                        <b>{{ $event->getTitle() }}</b>. {{ __('If you believe you have received this email in error,') }}
                        {{ __('please contact the event organizer at') }}
                        <a href="mailto:{{ $eventSettings->getSupportEmail() }}" style="color: #8a8597;">{{ $eventSettings->getSupportEmail() }}</a>.
                        {{ __('If you believe this is spam, please report it to') }}
                        <a href="mailto:{{ config('mail.from.address') }}" style="color: #8a8597;">{{ config('mail.from.address') }}</a>.
                    </td>
                </tr>

                <tr>
                    <td align="center" style="padding: 32px 0 8px;">
                        <a href="{{ $branding->platformUrl }}" style="display: inline-block;">
                            <img src="{{ $branding->platformLogoUrl }}" width="120" alt="DEHORS billetterie"
                                 style="display: block; width: 120px; height: auto; border: 0;">
                        </a>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 0 0 8px; color: #8a8597; font-size: 11px;">
                        {{-- In accordance with Section 7(b) of the AGPL, the "Powered by Hi.Events" notice is retained. --}}
                        {{ __('Powered by') }}
                        <a href="https://hi.events?utm_source=app-email-footer" style="color: #8a8597;">Hi.Events</a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
