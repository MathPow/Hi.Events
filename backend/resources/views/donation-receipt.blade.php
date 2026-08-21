@php use Carbon\Carbon; @endphp
@php use HiEvents\Helper\Currency; @endphp
@php /** @var \HiEvents\DomainObjects\DonationReceiptDomainObject $receipt */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php
    $currency = $receipt->getCurrency();
    $hasAdvantage = $receipt->getAdvantageAmount() > 0;
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Recu officiel {{ $receipt->getReceiptNumber() }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #1a1a1a;
            padding: 28px 34px;
        }

        .official-mention {
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            border: 2px solid #1a1a1a;
            padding: 8px 12px;
            text-align: center;
            margin-bottom: 22px;
        }

        table.layout { width: 100%; }
        table.layout td { vertical-align: top; }

        .charity-name { font-size: 18px; font-weight: 700; }
        .muted { color: #666; }
        .block { margin-bottom: 18px; }

        .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #666;
            margin-bottom: 2px;
        }

        table.amounts {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
        }

        table.amounts th,
        table.amounts td {
            border-bottom: 1px solid #e0e0e0;
            padding: 7px 4px;
            text-align: left;
        }

        table.amounts td.num { text-align: right; }

        table.amounts tr.eligible td {
            border-top: 2px solid #1a1a1a;
            border-bottom: none;
            font-weight: 700;
            font-size: 14px;
            padding-top: 9px;
        }

        .signature-line {
            margin-top: 6px;
            border-top: 1px solid #1a1a1a;
            width: 220px;
            padding-top: 4px;
        }

        .footer {
            margin-top: 26px;
            padding-top: 10px;
            border-top: 1px solid #e0e0e0;
            font-size: 10px;
            color: #666;
        }

        .warning {
            border: 1px solid #b00;
            color: #b00;
            padding: 7px 9px;
            margin-bottom: 16px;
            font-size: 11px;
        }
    </style>
</head>
<body>

<div class="official-mention">Recu officiel aux fins de l'impot</div>

@if(!$receipt->getDonorAddress())
    {{-- L'adresse complete du donateur est obligatoire. Mieux vaut un recu qui
         signale son propre defaut qu'un recu qui parait conforme sans l'etre. --}}
    <div class="warning">
        Adresse du donateur manquante. Ce recu est incomplet au sens des exigences
        de l'Agence du revenu du Canada et ne doit pas etre remis tel quel.
        Activez la collecte de l'adresse de facturation dans les reglages de l'evenement.
    </div>
@endif

<table class="layout block">
    <tr>
        <td style="width: 58%;">
            <div class="charity-name">{{ $receipt->getCharityLegalName() }}</div>
            @if($receipt->getCharityAddress())
                <div class="muted">{!! nl2br(e($receipt->getCharityAddress())) !!}</div>
            @endif
            <div style="margin-top: 6px;">
                <span class="muted">Numero d'enregistrement&nbsp;:</span>
                <strong>{{ $receipt->getCharityRegistrationNumber() }}</strong>
            </div>
        </td>
        <td style="text-align: right;">
            <div class="label">Numero du recu</div>
            <div><strong>{{ $receipt->getReceiptNumber() }}</strong></div>

            <div class="label" style="margin-top: 8px;">Date d'emission</div>
            <div>{{ Carbon::parse($receipt->getIssueDate())->format('Y-m-d') }}</div>

            @if($receipt->getCharityAddress())
                <div class="label" style="margin-top: 8px;">Lieu d'emission</div>
                <div>{{ collect(explode("\n", $receipt->getCharityAddress()))->last() }}</div>
            @endif
        </td>
    </tr>
</table>

<table class="layout block">
    <tr>
        <td style="width: 58%;">
            <div class="label">Donateur</div>
            <div><strong>{{ $receipt->getDonorName() }}</strong></div>
            @if($receipt->getDonorAddress())
                <div>{!! nl2br(e($receipt->getDonorAddress())) !!}</div>
            @endif
        </td>
        <td>
            <div class="label">Date du don</div>
            <div>{{ Carbon::parse($receipt->getDonationDate())->format('Y-m-d') }}</div>

            @if($event)
                <div class="label" style="margin-top: 8px;">Reference</div>
                <div class="muted">{{ $event->getTitle() }} &mdash; commande {{ $order->getShortId() }}</div>
            @endif
        </td>
    </tr>
</table>

<div class="block">
    <table class="amounts">
        <tr>
            <th>Montant total recu</th>
            <td class="num">{{ Currency::format($receipt->getTotalReceived(), $currency) }}</td>
        </tr>
        <tr>
            <th>
                Valeur de l'avantage recu
                @if($hasAdvantage)
                    <div class="muted" style="font-weight: 400;">
                        Juste valeur marchande de la contrepartie (billet, repas, prestation).
                    </div>
                @endif
            </th>
            <td class="num">{{ Currency::format($receipt->getAdvantageAmount(), $currency) }}</td>
        </tr>
        <tr class="eligible">
            <th>Montant admissible du don</th>
            <td class="num">{{ Currency::format($receipt->getEligibleAmount(), $currency) }}</td>
        </tr>
    </table>
</div>

<div class="block">
    <div class="label">Signature d'une personne autorisee</div>
    <div class="signature-line">{{ $receipt->getCharitySignatoryName() ?? '' }}</div>
</div>

<div class="footer">
    Agence du revenu du Canada&nbsp;: canada.ca/organismes-bienfaisance-dons<br>
    Ce recu doit etre conserve aux fins de votre declaration de revenus. En cas de
    correction, un recu de remplacement portant un nouveau numero sera emis et
    celui-ci deviendra sans effet.
</div>

</body>
</html>
