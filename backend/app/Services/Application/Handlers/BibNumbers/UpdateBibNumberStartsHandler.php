<?php

namespace HiEvents\Services\Application\Handlers\BibNumbers;

use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\Generated\ProductDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\ProductPriceDomainObjectAbstract;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Exceptions\InvalidProductPriceId;
use HiEvents\Repository\Interfaces\ProductPriceRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;

/**
 * The first bib number of each ticket option of an event (each distance);
 * an empty one gives no bibs to that option.
 */
class UpdateBibNumberStartsHandler
{
    public function __construct(
        private readonly ProductRepositoryInterface      $productRepository,
        private readonly ProductPriceRepositoryInterface $productPriceRepository,
    )
    {
    }

    /**
     * @param array<int, int|null> $starts The first number by product price id.
     * @throws InvalidProductPriceId
     */
    public function handle(int $eventId, array $starts): void
    {
        $ticketPriceIds = $this->productRepository
            ->loadRelation(ProductPriceDomainObject::class)
            ->findWhere([
                ProductDomainObjectAbstract::EVENT_ID => $eventId,
                ProductDomainObjectAbstract::PRODUCT_TYPE => ProductType::TICKET->name,
            ])
            ->flatMap(fn(ProductDomainObject $product) => $product->getProductPrices()
                ->map(fn(ProductPriceDomainObject $price) => $price->getId()))
            ->all();

        foreach (array_keys($starts) as $priceId) {
            if (!in_array($priceId, $ticketPriceIds, true)) {
                throw new InvalidProductPriceId(__('This ticket option does not belong to the event.'));
            }
        }

        foreach ($starts as $priceId => $start) {
            $this->productPriceRepository->updateWhere(
                attributes: [ProductPriceDomainObjectAbstract::BIB_NUMBER_START => $start],
                where: [ProductPriceDomainObjectAbstract::ID => $priceId],
            );
        }
    }
}
