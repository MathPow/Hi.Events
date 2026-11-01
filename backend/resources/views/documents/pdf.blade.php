@php /** @var string $title */ @endphp
@php /** @var string $organizerName */ @endphp
@php /** @var string $body */ @endphp
@php /** @var string[] $footer */ @endphp
<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="UTF-8">
    <title>{{ $title }}</title>
    <style>
        /* No "*" reset here: dompdf would apply it to the page margins too. */
        @page { margin: 20mm 18mm 18mm; }

        body {
            margin: 0;
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.55;
            color: #2b1f1a;
        }

        .header { margin-bottom: 18px; }
        table td { padding: 0; }
        .header td { vertical-align: middle; }
        td.initial {
            width: 26px;
            height: 26px;
            border-radius: 13px;
            background: #f47b52;
            color: #fff;
            font-weight: 700;
            font-size: 12px;
            text-align: center;
            vertical-align: middle;
            padding: 0;
        }
        .header td.organizer { font-weight: 700; font-size: 12px; padding-left: 8px; }

        h1 {
            font-size: 18px;
            line-height: 1.25;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin: 4px 0 10px;
        }

        p { margin: 0 0 8px; padding: 0; }
        ul { margin: 0 0 8px 18px; padding: 0; }
        li { margin-bottom: 3px; }
        strong { font-weight: 700; }
        em { font-style: italic; }
        hr { border: none; border-top: 1px solid #d8cfc8; margin: 12px 0; }

        table { border-collapse: collapse; }
        table.clause, table.check { width: 100%; margin-bottom: 6px; }
        table.clause td, table.check td { vertical-align: top; }
        table.clause p, table.check p { margin-bottom: 4px; }
        td.clause-number { width: 20px; font-weight: 700; }
        td.check-box { width: 18px; font-size: 13px; line-height: 1.2; }

        .auto { font-weight: 700; }
        .blank {
            display: inline-block;
            min-width: 120px;
            border-bottom: 1px solid #2b1f1a;
            color: #9a8b84;
            font-size: 8px;
            vertical-align: bottom;
            padding-top: 10px;
        }

        .field { margin: 6px 0 10px; }
        .field-label { font-size: 9.5px; color: #6f5f58; }
        .field-line { border-bottom: 1px solid #2b1f1a; min-height: 18px; padding: 3px 0 2px; }

        table.signature { width: 100%; margin: 22px 0 8px; page-break-inside: avoid; }
        table.signature td.line { width: 32%; border-bottom: 1px solid #2b1f1a; height: 24px; vertical-align: bottom; padding-bottom: 2px; }
        table.signature td.gap { width: 2%; }
        table.signature td.caption { font-size: 8.5px; color: #6f5f58; padding-top: 3px; }
        .typed { font-family: 'DejaVu Serif', serif; font-style: italic; font-size: 13px; }

        .footer {
            margin-top: 26px;
            padding-top: 8px;
            border-top: 1px solid #d8cfc8;
            font-size: 8.5px;
            color: #6f5f58;
        }
    </style>
</head>
<body>
<table class="header">
    <tr>
        <td class="initial">{{ mb_strtoupper(mb_substr($organizerName, 0, 1)) }}</td>
        <td class="organizer">{{ $organizerName }}</td>
    </tr>
</table>

{!! $body !!}

@if (!empty($footer))
    <div class="footer">
        @foreach ($footer as $line)
            <div>{{ $line }}</div>
        @endforeach
    </div>
@endif
</body>
</html>
