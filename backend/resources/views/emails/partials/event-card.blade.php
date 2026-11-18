{{-- The top of the public event page: cover, organizer, title, date and place. Inline styles only. --}}
@php /** @var \HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO $branding */ @endphp
@php
    $brown = '#352924';
    $muted = 'rgba(53, 41, 36, 0.7)';
    $display = "DehorsFatFrank, 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif";
    $text = "DehorsAllotrope, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    $initial = mb_strtoupper(mb_substr((string)$branding->organizerName, 0, 1));
    $rows = array_filter([
        $branding->dateLine ? ['icon' => 'calendrier', 'main' => $branding->dateLine, 'sub' => $branding->timezoneLine] : null,
        $branding->placeLine ? ['icon' => 'lieu', 'main' => $branding->placeLine, 'sub' => $branding->addressLine] : null,
    ]);
@endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="width: 100%; background-color: #fffcf8; border: 1px solid #f3e0d2; border-radius: 24px; border-collapse: separate;">
    @if($branding->eventCoverUrl)
        <tr>
            <td style="padding: 0; line-height: 0; font-size: 0;">
                <a href="{{ $branding->eventUrl ?? '#' }}" style="display: block; line-height: 0;">
                    <img src="{{ $branding->eventCoverUrl }}" width="598" alt=""
                         style="display: block; width: 100%; max-width: 598px; height: auto; border: 0; border-radius: 23px 23px 0 0;">
                </a>
            </td>
        </tr>
    @endif
    <tr>
        <td class="event-card-cell" style="padding: 24px 32px 18px;">
            @if($branding->organizerName)
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 0 10px 0 0; vertical-align: middle;">
                            @if($branding->organizerLogoUrl)
                                <img src="{{ $branding->organizerLogoUrl }}" width="32" height="32" alt=""
                                     style="display: block; width: 32px; height: 32px; border: 0; border-radius: 8px;">
                            @else
                                <div style="width: 32px; height: 32px; border-radius: 8px; background-color: {{ $branding->accentColor }}; color: {{ $branding->accentTextColor }}; font-family: {{ $text }}; font-size: 16px; font-weight: bold; line-height: 32px; text-align: center;">{{ $initial }}</div>
                            @endif
                        </td>
                        <td style="vertical-align: middle; font-family: {{ $text }}; font-size: 15px; font-weight: bold; color: {{ $brown }};">
                            {{ $branding->organizerName }}
                        </td>
                    </tr>
                </table>
            @endif

            <h1 style="margin: 16px 0 20px; font-family: {{ $display }}; font-size: 30px; font-weight: 900; line-height: 1.02; letter-spacing: 0.01em; text-transform: uppercase; color: {{ $brown }}; text-align: left;">
                @if($branding->eventUrl)
                    <a href="{{ $branding->eventUrl }}" style="color: {{ $brown }}; font-family: {{ $display }}; font-weight: 900; text-decoration: none;">{{ $branding->eventTitle }}</a>
                @else
                    {{ $branding->eventTitle }}
                @endif
            </h1>

            @foreach($rows as $row)
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td width="40" style="width: 40px; padding: 0 14px 14px 0; vertical-align: top;">
                            <div style="width: 40px; height: 40px; border-radius: 10px; background-color: {{ $branding->accentSoftColor }}; text-align: center; line-height: 40px; font-size: 0;">
                                <img src="{{ $branding->assetsUrl }}/interface/courriels/{{ $row['icon'] }}.png" width="18" height="18" alt=""
                                     style="display: inline-block; width: 18px; height: 18px; border: 0; vertical-align: middle;">
                            </div>
                        </td>
                        <td style="padding: 0 0 14px; vertical-align: middle; font-family: {{ $text }};">
                            <div style="font-size: 15px; font-weight: bold; line-height: 1.35; color: {{ $brown }};">{{ $row['main'] }}</div>
                            @if($row['sub'])
                                <div style="font-size: 14px; line-height: 1.35; color: {{ $muted }};">{{ $row['sub'] }}</div>
                            @endif
                        </td>
                    </tr>
                </table>
            @endforeach
        </td>
    </tr>
</table>
