<?php

namespace HiEvents\Services\Domain\DonationReceipt;

use HiEvents\DomainObjects\Enums\ProductPriceType;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Helper\Currency;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Services\Domain\DonationReceipt\DTO\DonationBreakdownDTO;

/**
 * Decoupe une commande en « don admissible » et « contrepartie ».
 *
 * Deux sources de don coexistent, volontairement:
 *
 *   - un produit de type DONATION: montant libre, aucune contrepartie, donc
 *     admissible a 100 %;
 *   - un produit ordinaire portant un charity_amount: billet-benefice, ou seule
 *     la part au-dela de la juste valeur marchande est admissible.
 *
 * Les taxes et frais de service sont exclus du calcul: on part de order_item
 * ->getPrice() (prix unitaire hors additions) et non de total_gross. Une TPS
 * facturee sur un billet n'est pas un don.
 */
class DonationBreakdownService
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
    )
    {
    }

    public function calculateForOrder(OrderDomainObject $order): DonationBreakdownDTO
    {
        $items = $order->getOrderItems() ?? collect();

        $productIds = collect($items)
            ->map(fn(OrderItemDomainObject $item) => $item->getProductId())
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($productIds === []) {
            return new DonationBreakdownDTO(0.0, 0.0, 0.0);
        }

        $products = $this->productRepository
            ->findWhereIn('id', $productIds)
            ->keyBy(fn(ProductDomainObject $product) => $product->getId());

        $totalReceived = 0.0;
        $advantage = 0.0;

        foreach ($items as $item) {
            /** @var ProductDomainObject|null $product */
            $product = $products->get($item->getProductId());

            if ($product === null) {
                continue;
            }

            $lineTotal = $item->getPrice() * $item->getQuantity();

            if ($product->getType() === ProductPriceType::DONATION->name) {
                $totalReceived += $lineTotal;
                continue;
            }

            $charityAmount = $product->getCharityAmount();

            if ($charityAmount === null || $charityAmount <= 0) {
                continue;
            }

            // Garde-fou: un charity_amount mal saisi, superieur au prix paye,
            // produirait une contrepartie negative et donc un recu gonfle.
            $giftPerUnit = min($charityAmount, $item->getPrice());

            $totalReceived += $lineTotal;
            $advantage += ($item->getPrice() - $giftPerUnit) * $item->getQuantity();
        }

        $totalReceived = Currency::round($totalReceived);
        $advantage = Currency::round($advantage);

        return new DonationBreakdownDTO(
            totalReceived: $totalReceived,
            advantageAmount: $advantage,
            eligibleAmount: Currency::round($totalReceived - $advantage),
        );
    }
}
