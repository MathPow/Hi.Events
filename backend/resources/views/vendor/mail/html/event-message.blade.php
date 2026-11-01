{{-- A participant email, like the public event page: the event card, then the message, then the footer. --}}
@props(['branding', 'note' => null, 'footer' => null])
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="{{ app()->getLocale() }}" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>{{ $branding->eventTitle }}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    @include('emails.partials.fonts')
    <style>
        .organizer-note p:last-child {
            margin-bottom: 0;
        }

        @media only screen and (max-width: 600px) {
            .event-card-cell,
            .message-cell {
                padding-left: 22px !important;
                padding-right: 22px !important;
            }

            .button {
                width: 100% !important;
                text-align: center !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #fff7e9;">
<table class="wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #fff7e9;">
    <tr>
        <td align="center" style="padding: 28px 12px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 600px;">
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
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                               style="width: 100%; background-color: #fffcf8; border: 1px solid #f3e0d2; border-radius: 24px; border-collapse: separate;">
                            <tr>
                                <td class="message-cell" style="padding: 30px 32px 28px;">
                                    @if($note)
                                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                                               style="width: 100%; margin: 0 0 24px; background-color: {{ $branding->accentSoftColor }}; border-radius: 16px; border-collapse: separate;">
                                            <tr>
                                                <td style="padding: 16px 20px;">
                                                    <div style="margin: 0 0 6px; font-size: 12px; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; color: {{ $branding->accentDeepColor }};">
                                                        {{ __('A word from :organizer', ['organizer' => $branding->organizerName ?: __('the organizer')]) }}
                                                    </div>
                                                    <div class="organizer-note" style="font-size: 16px; line-height: 1.55; color: #352924;">
                                                        {!! $note !!}
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    @endif

                                    {{ Illuminate\Mail\Markdown::parse($slot) }}

                                    @if($footer)
                                        <div style="margin-top: 8px; padding-top: 16px; border-top: 1px solid #f1dccd; font-size: 14px; line-height: 1.5; color: rgba(53, 41, 36, 0.7);">
                                            {!! $footer !!}
                                        </div>
                                    @endif
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
