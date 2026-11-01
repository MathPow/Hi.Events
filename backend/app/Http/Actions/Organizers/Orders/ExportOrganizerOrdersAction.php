<?php

namespace HiEvents\Http\Actions\Organizers\Orders;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\DTO\QueryParamsDTO;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Infrastructure\Export\SpreadsheetFormulaEscaper;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * « Exporter (CSV) » de la page Commandes : les commandes de tous les evenements de
 * l'organisateur, avec la recherche et les filtres de la page (evenement, dates, onglet).
 */
class ExportOrganizerOrdersAction extends BaseAction
{
    private const MAX_EXPORT_ROWS = 15000;

    public function __construct(
        private readonly OrderRepositoryInterface  $orderRepository,
        private readonly SpreadsheetFormulaEscaper $formulaEscaper,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId): StreamedResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $params = $this->getPaginationQueryParams($request);
        $orders = $this->orderRepository
            ->setMaxPerPage(self::MAX_EXPORT_ROWS)
            ->loadRelation(OrderItemDomainObject::class)
            ->loadRelation(new Relationship(domainObject: EventDomainObject::class, name: 'event'))
            ->findByOrganizerId(
                organizerId: $organizerId,
                accountId: $this->getAuthenticatedAccountId(),
                params: new QueryParamsDTO(
                    page: 1,
                    per_page: self::MAX_EXPORT_ROWS,
                    sort_by: $params->sort_by,
                    sort_direction: $params->sort_direction,
                    query: $params->query,
                    filter_fields: $params->filter_fields,
                ),
            );

        $filename = 'commandes_' . date('Y-m-d') . '.csv';

        return new StreamedResponse(function () use ($orders) {
            $handle = fopen('php://output', 'w');
            // Excel reconnait l'UTF-8 (accents) grace a ce BOM.
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                __('Order'),
                __('Created At'),
                __('First Name'),
                __('Last Name'),
                __('Email'),
                __('Event'),
                __('Items'),
                __('Total Gross'),
                __('Currency'),
                __('Status'),
                __('Payment Status'),
                __('Refund Status'),
            ]);

            /** @var OrderDomainObject $order */
            foreach ($orders as $order) {
                $items = collect($order->getOrderItems() ?? [])
                    ->map(fn(OrderItemDomainObject $item) => $item->getQuantity() . ' × ' . $item->getItemName())
                    ->implode(', ');

                fputcsv($handle, $this->formulaEscaper->escapeRow([
                    $order->getPublicId(),
                    $order->getCreatedAt(),
                    $order->getFirstName(),
                    $order->getLastName(),
                    $order->getEmail(),
                    $order->getEvent()?->getTitle(),
                    $items,
                    $order->getTotalGross(),
                    $order->getCurrency(),
                    $order->getStatus(),
                    $order->getPaymentStatus(),
                    $order->getRefundStatus(),
                ]));
            }

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }
}
