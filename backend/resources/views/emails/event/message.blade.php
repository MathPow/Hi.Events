@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\Services\Application\Handlers\Message\DTO\SendMessageDTO $messageData */ @endphp
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp

@php /** @see \HiEvents\Mail\Event\EventMessage */ @endphp

@php
    $text = "DehorsAllotrope, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    $brown = '#352924';
    $muted = 'rgba(53, 41, 36, 0.62)';
@endphp
<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>{{ $messageData->subject }}</title>
    @include('emails.partials.fonts')
    <style>
        .message-body p { margin: 0 0 1em; }
        .message-body p:last-child { margin-bottom: 0; }
        .message-body a, .footer-message a { color: {{ $branding->accentDeepColor }}; font-weight: bold; }
        .message-body img { max-width: 100%; height: auto; }
        @media only screen and (max-width: 600px) {
            .event-card-cell, .message-cell { padding-left: 22px !important; padding-right: 22px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #fff7e9; -webkit-text-size-adjust: 100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff7e9;">
    <tr>
        <td align="center" style="padding: 28px 12px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
                <tr>
                    <td>
                        @include('emails.partials.event-card', ['branding' => $branding])
                    </td>
                </tr>
                <tr>
                    <td style="height: 14px; line-height: 14px; font-size: 0;">&nbsp;</td>
                </tr>
                <tr>
                    <td>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                               style="width: 100%; background-color: #fffcf8; border: 1px solid #f3e0d2; border-radius: 24px; border-collapse: separate;">
                            <tr>
                                <td class="message-cell" style="padding: 30px 32px 28px; font-family: {{ $text }};">
                                    <div class="message-body" style="color: {{ $brown }}; font-family: {{ $text }}; font-size: 16px; line-height: 1.6;">
                                        {!! $messageData->message !!}
                                    </div>

                                    @if($eventSettings->getGetEmailFooterHtml())
                                        <div class="footer-message"
                                             style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1dccd; color: {{ $muted }}; font-family: {{ $text }}; font-size: 14px; line-height: 1.5;">
                                            {!! $eventSettings->getGetEmailFooterHtml() !!}
                                        </div>
                                    @endif

                                    <p style="margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #f1dccd; color: {{ $muted }}; font-family: {{ $text }}; font-size: 12px; line-height: 1.5;">
                                        {{ __('You are receiving this communication because you are registered as an attendee for the following event:') }}
                                        <b>{{ $event->getTitle() }}</b>. {{ __('If you believe you have received this email in error,') }}
                                        {{ __('please contact the event organizer at') }}
                                        <a href="mailto:{{ $eventSettings->getSupportEmail() }}" style="color: {{ $muted }};">{{ $eventSettings->getSupportEmail() }}</a>.
                                        {{ __('If you believe this is spam, please report it to') }}
                                        <a href="mailto:{{ config('mail.from.address') }}" style="color: {{ $muted }};">{{ config('mail.from.address') }}</a>.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td>
                        @include('emails.partials.event-footer', ['branding' => $branding])
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
