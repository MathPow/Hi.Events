@php use Carbon\Carbon; @endphp
@php /** @var \Illuminate\Support\Collection $tickets */ @endphp
@php /** @var \HiEvents\DomainObjects\OrderDomainObject $order */ @endphp
@php /** @var \HiEvents\DomainObjects\EventDomainObject $event */ @endphp
@php /** @var \HiEvents\DomainObjects\EventSettingDomainObject $eventSettings */ @endphp
@php /** @var \HiEvents\DomainObjects\OrganizerDomainObject $organizer */ @endphp
@php /** @see \HiEvents\Services\Domain\Attendee\GenerateAttendeeTicketPDFService */ @endphp
@php
    $startDate = Carbon::parse($event->getStartDate(), $event->getTimezone());
    $endDate = $event->getEndDate() ? Carbon::parse($event->getEndDate(), $event->getTimezone()) : null;
    $venue = $eventSettings->getLocationDetails() ? $eventSettings->getAddressString() : null;
@endphp

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <title>{{ $event->getTitle() }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #1a1a1a;
            padding: 30px;
        }

        .ticket {
            border: 2px solid #1a1a1a;
            border-radius: 8px;
            padding: 24px;
        }

        .page-break {
            page-break-after: always;
        }

        .event-title {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
        }

        .organizer {
            font-size: 12px;
            color: #666;
            margin-bottom: 18px;
        }

        table.body-table {
            width: 100%;
        }

        table.body-table td {
            vertical-align: top;
        }

        td.details {
            padding-right: 20px;
        }

        td.qr {
            width: 190px;
            text-align: center;
        }

        td.qr img {
            width: 170px;
            height: 170px;
        }

        .label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #888;
            margin-top: 12px;
        }

        .value {
            font-size: 14px;
            font-weight: 700;
        }

        .ticket-id {
            font-family: 'DejaVu Sans Mono', monospace;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-top: 6px;
        }

        .notice {
            margin-top: 20px;
            padding-top: 14px;
            border-top: 1px solid #ddd;
            font-size: 10px;
            color: #666;
        }

        .unpaid {
            margin-bottom: 16px;
            padding: 10px 12px;
            border-radius: 4px;
            background-color: #f8d7da;
            color: #842029;
            font-size: 11px;
        }
    </style>
</head>
<body>
@foreach($tickets as $ticket)
    @php /** @var \HiEvents\DomainObjects\AttendeeDomainObject $attendee */ @endphp
    @php $attendee = $ticket['attendee']; @endphp

    <div class="ticket">
        <div class="event-title">{{ $event->getTitle() }}</div>
        <div class="organizer">{{ $organizer->getName() }}</div>

        @if($order->isOrderAwaitingOfflinePayment())
            <div class="unpaid">
                {{ __('This ticket is not valid until payment is received.') }}
            </div>
        @endif

        <table class="body-table">
            <tr>
                <td class="details">
                    <div class="label">{{ __('Attendee') }}</div>
                    <div class="value">{{ $attendee->getFullName() }}</div>

                    @if($ticket['productName'])
                        <div class="label">{{ __('Ticket') }}</div>
                        <div class="value">{{ $ticket['productName'] }}</div>
                    @endif

                    <div class="label">{{ __('When') }}</div>
                    <div class="value">
                        {{ $startDate->translatedFormat('D j M Y, H:i') }}
                        @if($endDate)
                            &ndash; {{ $endDate->translatedFormat('D j M Y, H:i') }}
                        @endif
                    </div>

                    @if($venue)
                        <div class="label">{{ __('Where') }}</div>
                        <div class="value">{{ $venue }}</div>
                    @endif

                    <div class="label">{{ __('Ticket ID') }}</div>
                    <div class="ticket-id">{{ $attendee->getPublicId() }}</div>
                </td>
                <td class="qr">
                    <img src="{{ $ticket['qrCode'] }}" alt="{{ $attendee->getPublicId() }}">
                </td>
            </tr>
        </table>

        <div class="notice">
            {{ __('This QR code can only be scanned once. Please do not share it.') }}
            @if($eventSettings->getSupportEmail())
                {{ __('Questions? Contact :email', ['email' => $eventSettings->getSupportEmail()]) }}
            @endif
        </div>
    </div>

    @if(!$loop->last)
        <div class="page-break"></div>
    @endif
@endforeach
</body>
</html>
