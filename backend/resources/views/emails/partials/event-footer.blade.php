{{-- Who to write to, and « Propulsé par Hi.Events et DehorsQC » like the public pages. --}}
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php
    $brown = '#352924';
    $text = "DehorsAllotrope, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    $link = "color: {$brown}; font-family: {$text}; font-weight: bold; text-decoration: none;";
@endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
        <td align="center" style="padding: 24px 16px 8px; font-family: {{ $text }};">
            @if($branding->supportEmail)
                <p style="margin: 0 0 16px; font-family: {{ $text }}; font-size: 13px; line-height: 1.5; color: rgba(53, 41, 36, 0.7); text-align: center;">
                    {{ __('Questions? Write to :organizer:', ['organizer' => $branding->organizerName ?: __('the organizer')]) }}
                    <a href="mailto:{{ $branding->supportEmail }}" style="color: {{ $branding->accentDeepColor }}; font-family: {{ $text }}; font-weight: bold;">{{ $branding->supportEmail }}</a>
                </p>
            @endif
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    {{-- In accordance with Section 7(b) of the AGPL, the "Powered by Hi.Events" notice is retained. --}}
                    <td style="background-color: {{ $branding->accentSoftColor }}; border-radius: 999px; padding: 8px 16px; font-family: {{ $text }}; font-size: 12px; font-weight: bold; color: {{ $brown }};">
                        {!! __('Powered by :hievents and :dehors', [
                            'hievents' => '<a href="https://hi.events?utm_source=app-email-footer" style="' . $link . '">Hi.Events</a>',
                            'dehors' => '<a href="https://dehorsqc.com" style="' . $link . '">DehorsQC</a>',
                        ]) !!}
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
