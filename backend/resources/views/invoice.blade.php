@php use Carbon\Carbon; @endphp
@php use HiEvents\Helper\Currency; @endphp
@php use HiEvents\DomainObjects\Status\InvoiceStatus; @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\InvoiceDomainObject $invoice */ @endphp
@php
    $isPaid = $invoice->getStatus() === InvoiceStatus::PAID->name;
    $isVoid = $invoice->getStatus() === InvoiceStatus::VOID->name;
    $locale = str_replace('_', '-', app()->getLocale());
    $isFrench = str_starts_with($locale, 'fr');
    // 9.975 -> « 9,975 % » in French, « 9.975% » in English
    $formatRate = static function ($rate) use ($isFrench): string {
        $number = rtrim(rtrim(number_format((float) $rate, 3, '.', ''), '0'), '.');
        return $isFrench ? str_replace('.', ',', $number) . "\u{00A0}%" : $number . '%';
    };
    $formatDate = static fn($date): string => Carbon::parse($date)->locale(app()->getLocale())->isoFormat('LL');
    $dehorsMark = 'data:image/svg+xml;base64,' . base64_encode((string) @file_get_contents(resource_path('images/dehors-billet.svg')));
@endphp

<!DOCTYPE html>
<html lang="{{ $locale }}">
<head>
    <meta charset="UTF-8">
    <title>{{ $eventSettings->getInvoiceLabel() ?? __('Invoice') }} #{{ $invoice->getInvoiceNumber() }}</title>
    <style>
        /* No "*" reset: dompdf would apply it to the page margins too. */
        @page { margin: 16mm 16mm 14mm; }

        body {
            margin: 0;
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #2b1f1a;
        }

        p { margin: 0; }
        table { border-collapse: collapse; }
        td, th { padding: 0; }

        .accent { height: 4px; background: #f47755; margin-bottom: 22px; }

        table.header { width: 100%; margin-bottom: 22px; }
        table.header td { vertical-align: top; }

        .title {
            font-size: 24px;
            line-height: 1.1;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 6px;
        }

        .event-name { font-size: 12px; font-weight: bold; }
        .event-date { color: #6f5f58; }

        .seller { text-align: right; line-height: 1.6; color: #6f5f58; }
        .seller-name { font-weight: bold; font-size: 12px; color: #2b1f1a; }

        table.facts {
            width: 100%;
            margin-bottom: 18px;
            border-top: 1px solid #2b1f1a;
            border-bottom: 1px solid #e6dcd5;
        }
        table.facts td { padding: 10px 12px 10px 0; vertical-align: top; }

        .label {
            display: block;
            font-size: 8.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #8a7a72;
            margin-bottom: 3px;
        }
        .value { font-size: 12px; font-weight: bold; }

        .status {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 9px;
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.6px;
        }
        .status-paid { background: #e5f2e6; color: #2f6b3a; }
        .status-unpaid { background: #fde9e2; color: #b4472a; }
        .status-void { background: #efebe8; color: #8a7a72; }

        .billed { margin-bottom: 22px; line-height: 1.6; }
        .billed-name { font-weight: bold; font-size: 12px; }

        table.items { width: 100%; margin-bottom: 12px; }
        .items th {
            text-align: left;
            padding: 0 10px 7px 0;
            font-size: 8.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #8a7a72;
            border-bottom: 1px solid #2b1f1a;
        }
        .items td { padding: 10px 10px 10px 0; border-bottom: 1px solid #e6dcd5; vertical-align: top; }
        .items th.align-right { text-align: right; }
        .items th.last, .items td.last { padding-right: 0; }
        .item-name { font-weight: bold; }
        .item-description { color: #8a7a72; font-size: 10px; margin-top: 2px; }
        .item-price-original { color: #a2938b; text-decoration: line-through; font-size: 10px; }

        .align-right { text-align: right; }
        .col-description { width: 52%; }
        .col-rate { width: 18%; }
        .col-qty { width: 10%; }
        .col-amount { width: 20%; }

        table.totals { width: 290px; margin-left: auto; }
        .totals td { padding: 4px 0; text-align: right; }
        .totals td.amount { width: 110px; }
        .totals .strong td { font-weight: bold; }
        .totals .muted td { color: #8a7a72; font-size: 10px; }
        .totals .total td {
            border-top: 1px solid #2b1f1a;
            padding-top: 9px;
            font-size: 14px;
            font-weight: bold;
        }
        .totals .paid td { color: #2f6b3a; }
        .totals .balance td { border-top: 1px solid #e6dcd5; padding-top: 7px; font-weight: bold; }

        .notes {
            margin-top: 24px;
            padding: 12px 14px;
            background: #fff6ed;
            border-left: 3px solid #f47755;
            color: #6f5f58;
            line-height: 1.6;
        }

        .footer {
            margin-top: 30px;
            padding-top: 12px;
            border-top: 1px solid #e6dcd5;
            color: #8a7a72;
            font-size: 9.5px;
            line-height: 1.6;
        }
        .footer p { margin-bottom: 4px; }
        .tax-info strong { color: #6f5f58; }

        table.mark { margin-top: 10px; }
        table.mark td { vertical-align: middle; color: #a2938b; font-size: 8.5px; }
        table.mark img { width: 13px; height: 12px; }
    </style>
</head>
<body>
<div class="accent"></div>

<table class="header">
    <tr>
        <td style="width: 55%;">
            <div class="title">{{ $eventSettings->getInvoiceLabel() ?? __('Invoice') }}</div>
            <div class="event-name">{{ $event->getTitle() }}</div>
            @if($event->getStartDate())
                <div class="event-date">{{ $formatDate(Carbon::parse($event->getStartDate(), 'UTC')->setTimezone($event->getTimezone())) }}</div>
            @endif
        </td>
        <td class="seller">
            <div class="seller-name">{{ $eventSettings->getOrganizationName() ?: $organizer?->getName() }}</div>
            @if($eventSettings->getOrganizationAddress())
                <div>{!! $eventSettings->getOrganizationAddress() !!}</div>
            @endif
            @if($eventSettings->getSupportEmail())
                <div>{{ $eventSettings->getSupportEmail() }}</div>
            @endif
        </td>
    </tr>
</table>

<table class="facts">
    <tr>
        <td>
            <span class="label">{{ __('Invoice Number') }}</span>
            <span class="value">#{{ $invoice->getInvoiceNumber() }}</span>
        </td>
        <td>
            <span class="label">{{ __('Date Issued') }}</span>
            <span class="value">{{ $formatDate($invoice->getIssueDate()) }}</span>
        </td>
        @if(!$isPaid && $invoice->getDueDate())
            <td>
                <span class="label">{{ __('Due Date') }}</span>
                <span class="value">{{ $formatDate($invoice->getDueDate()) }}</span>
            </td>
        @endif
        <td>
            <span class="label">{{ $isPaid ? __('Amount Paid') : __('Amount Due') }}</span>
            <span class="value">{{ Currency::format($order->getTotalGross(), $order->getCurrency()) }}</span>
        </td>
        <td style="padding-right: 0;">
            <span class="label">{{ __('Status') }}</span>
            @if($isPaid)
                <span class="status status-paid">{{ __('Paid') }}</span>
            @elseif($isVoid)
                <span class="status status-void">{{ __('Void') }}</span>
            @else
                <span class="status status-unpaid">{{ __('Unpaid') }}</span>
            @endif
        </td>
    </tr>
</table>

<div class="billed">
    <span class="label">{{ __('Billed To') }}</span>
    <div class="billed-name">{{ $order->getFullName() }}</div>
    <div>{{ $order->getEmail() }}</div>
    @if($order->getAddress())
        <div>{{ $order->getBillingAddressString() }}</div>
    @endif
</div>

<table class="items">
    <thead>
    <tr>
        <th class="col-description">{{ __('Description') }}</th>
        <th class="col-rate align-right">{{ __('Rate') }}</th>
        <th class="col-qty align-right">{{ __('Qty') }}</th>
        <th class="col-amount align-right last">{{ __('Amount') }}</th>
    </tr>
    </thead>
    <tbody>
    @php $totalDiscount = 0; @endphp
    @foreach($invoice->getItems() as $orderItem)
        @php
            $itemDiscount = 0;
            if ($orderItem['price_before_discount']) {
                $itemDiscount = ($orderItem['price_before_discount'] - $orderItem['price']) * $orderItem['quantity'];
                $totalDiscount += $itemDiscount;
            }
        @endphp
        <tr>
            <td>
                <div class="item-name">{{ $orderItem['item_name'] }}</div>
                @if(!empty($orderItem['description']))
                    <div class="item-description">{{ $orderItem['description'] }}</div>
                @endif
            </td>
            <td class="align-right">
                @if($orderItem['price_before_discount'])
                    <div class="item-price-original">{{ Currency::format($orderItem['price_before_discount'], $order->getCurrency()) }}</div>
                @endif
                {{ Currency::format($orderItem['price'], $order->getCurrency()) }}
            </td>
            <td class="align-right">{{ $orderItem['quantity'] }}</td>
            <td class="align-right last">
                @if($orderItem['price_before_discount'])
                    <div class="item-price-original">{{ Currency::format($orderItem['price_before_discount'] * $orderItem['quantity'], $order->getCurrency()) }}</div>
                @endif
                {{ Currency::format($orderItem['total_before_additions'], $order->getCurrency()) }}
            </td>
        </tr>
    @endforeach
    </tbody>
</table>

<table class="totals">
    <tr class="strong">
        <td>{{ __('Subtotal') }}</td>
        <td class="amount">{{ Currency::format($order->getTotalBeforeAdditions(), $order->getCurrency()) }}</td>
    </tr>

    @if($totalDiscount > 0)
        <tr class="muted">
            <td>{{ __('Total Discount') }}</td>
            <td class="amount">-{{ Currency::format($totalDiscount, $order->getCurrency()) }}</td>
        </tr>
    @endif

    @if($order->getHasTaxes())
        @foreach($order->getTaxesAndFeesRollup()['taxes'] as $tax)
            <tr class="muted">
                <td>{{ $tax['name'] }} ({{ $tax['type'] === 'PERCENTAGE' ? $formatRate($tax['rate']) : Currency::format($tax['rate'], $order->getCurrency()) }})</td>
                <td class="amount">{{ Currency::format($tax['value'], $order->getCurrency()) }}</td>
            </tr>
        @endforeach
        <tr class="strong">
            <td>{{ __('Total Tax') }}</td>
            <td class="amount">{{ Currency::format($order->getTotalTax(), $order->getCurrency()) }}</td>
        </tr>
    @endif

    @if($order->getHasFees())
        @foreach($order->getTaxesAndFeesRollup()['fees'] as $fee)
            <tr class="muted">
                <td>{{ $fee['name'] }} ({{ $fee['type'] === 'PERCENTAGE' ? $formatRate($fee['rate']) : Currency::format($fee['rate'], $order->getCurrency()) }})</td>
                <td class="amount">{{ Currency::format($fee['value'], $order->getCurrency()) }}</td>
            </tr>
        @endforeach
        <tr class="strong">
            <td>{{ __('Total Service Fee') }}</td>
            <td class="amount">{{ Currency::format($order->getTotalFee(), $order->getCurrency()) }}</td>
        </tr>
    @endif

    @if($order->getPlatformContribution() > 0)
        <tr class="strong">
            <td>{{ __('Support the platform') }}</td>
            <td class="amount">{{ Currency::format($order->getPlatformContribution(), $order->getCurrency()) }}</td>
        </tr>
    @endif

    <tr class="total">
        <td>{{ __('Total') }}</td>
        <td class="amount">{{ Currency::format($order->getTotalGross(), $order->getCurrency()) }}</td>
    </tr>

    @if($isPaid)
        <tr class="paid">
            <td>{{ __('Amount Paid') }}</td>
            <td class="amount">-{{ Currency::format($order->getTotalGross(), $order->getCurrency()) }}</td>
        </tr>
        <tr class="balance">
            <td>{{ __('Balance Due') }}</td>
            <td class="amount">{{ Currency::format(0, $order->getCurrency()) }}</td>
        </tr>
    @endif
</table>

@if($eventSettings->getInvoiceNotes())
    <div class="notes">
        {!! $eventSettings->getInvoiceNotes() !!}
    </div>
@endif

<div class="footer">
    @if($eventSettings->getSupportEmail())
        <p>{{ __('For any queries, please contact us at') }} {{ $eventSettings->getSupportEmail() }}</p>
    @endif

    @if((bool) $eventSettings->getInvoiceTaxDetails())
        <div class="tax-info">
            <strong>{{ __('Tax Information') }}</strong>
            {!! $eventSettings->getInvoiceTaxDetails() !!}
        </div>
    @endif

    <table class="mark">
        <tr>
            <td style="padding-right: 5px;"><img src="{{ $dehorsMark }}" alt=""></td>
            <td>billets.dehorsqc.com</td>
        </tr>
    </table>
</div>
</body>
</html>
