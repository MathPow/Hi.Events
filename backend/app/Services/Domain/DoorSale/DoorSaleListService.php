<?php

namespace HiEvents\Services\Domain\DoorSale;

use HiEvents\DomainObjects\CheckInListDomainObject;
use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\Enums\TaxCalculationType;
use HiEvents\DomainObjects\Generated\CheckInListDomainObjectAbstract;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\TaxAndFeesDomainObject;
use HiEvents\Exceptions\DoorSalesNotEnabledException;
use HiEvents\Exceptions\InvalidProductPriceId;
use HiEvents\Exceptions\ProductNotOnCheckInListException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\CheckInListRepositoryInterface;
use HiEvents\Services\Application\Handlers\Attendee\DTO\CreateAttendeeTaxAndFeeDTO;
use HiEvents\Services\Domain\Product\AvailableProductQuantitiesFetchService;
use HiEvents\Services\Domain\Product\DTO\AvailableProductQuantitiesDTO;
use Illuminate\Support\Collection;

/**
 * Resolves what a volunteer standing at the door is allowed to sell from a given check-in list, and
 * at what price.
 */
class DoorSaleListService
{
    public function __construct(
        private readonly CheckInListRepositoryInterface         $checkInListRepository,
        private readonly AvailableProductQuantitiesFetchService $availableProductQuantitiesFetchService,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     * @throws DoorSalesNotEnabledException
     */
    public function getSellableCheckInList(string $checkInListShortId): CheckInListDomainObject
    {
        $checkInList = $this->checkInListRepository
            ->loadRelation(new Relationship(
                domainObject: ProductDomainObject::class,
                nested: [
                    new Relationship(ProductPriceDomainObject::class),
                    new Relationship(TaxAndFeesDomainObject::class),
                ],
            ))
            ->findFirstWhere([
                CheckInListDomainObjectAbstract::SHORT_ID => $checkInListShortId,
            ]);

        if ($checkInList === null) {
            throw new ResourceNotFoundException(__('Check-in list not found'));
        }

        if (!$checkInList->getAllowDoorSales()) {
            throw new DoorSalesNotEnabledException(
                __('Selling at the door is not enabled for this check-in list.')
            );
        }

        return $checkInList;
    }

    /**
     * Tickets on the list, each price annotated with how many are left.
     *
     * @return Collection<int, ProductDomainObject>
     */
    public function getSellableProducts(CheckInListDomainObject $checkInList): Collection
    {
        $quantities = $this->getAvailableQuantities($checkInList->getEventId());

        return $checkInList->getProducts()
            ?->filter(fn(ProductDomainObject $product) => $product->getProductType() === ProductType::TICKET->name)
            ->each(function (ProductDomainObject $product) use ($quantities) {
                $product->getProductPrices()?->each(function (ProductPriceDomainObject $price) use ($quantities) {
                    $price->setQuantityAvailable(
                        max($quantities->firstWhere('price_id', $price->getId())?->quantity_available ?? 0, 0)
                    );
                });
            })
            ->values() ?? collect();
    }

    /**
     * @throws ProductNotOnCheckInListException
     */
    public function verifyProductIsOnCheckInList(
        CheckInListDomainObject $checkInList,
        int                     $productId
    ): ProductDomainObject
    {
        $product = $checkInList->getProducts()?->first(
            fn(ProductDomainObject $product) => $product->getId() === $productId
        );

        if ($product === null) {
            throw new ProductNotOnCheckInListException(
                __('That ticket cannot be sold from this check-in list.')
            );
        }

        if ($product->getProductType() !== ProductType::TICKET->name) {
            throw new ProductNotOnCheckInListException(__('Only tickets can be sold at the door.'));
        }

        return $product;
    }

    /**
     * @throws InvalidProductPriceId
     */
    public function resolveProductPrice(ProductDomainObject $product, ?int $productPriceId): ProductPriceDomainObject
    {
        $prices = $product->getProductPrices() ?? collect();

        $price = $productPriceId === null
            ? $prices->first()
            : $prices->first(fn(ProductPriceDomainObject $price) => $price->getId() === $productPriceId);

        if ($price === null) {
            throw new InvalidProductPriceId(__('The product price ID is invalid.'));
        }

        return $price;
    }

    /**
     * The door charges the configured price - a volunteer never types an amount - so the taxes and
     * fees are the ones the product carries, applied the same way checkout applies them: fees on
     * the base price, then taxes on price plus fees.
     *
     * @return Collection<int, CreateAttendeeTaxAndFeeDTO>
     */
    public function resolveTaxesAndFees(ProductDomainObject $product, float $price): Collection
    {
        $taxesAndFees = collect();

        $feeTotal = 0.0;

        $product->getFees()?->each(function (TaxAndFeesDomainObject $fee) use ($price, &$feeTotal, $taxesAndFees) {
            $amount = $this->amountFor($fee, $price);
            $feeTotal += $amount;
            $taxesAndFees->push(new CreateAttendeeTaxAndFeeDTO(
                tax_or_fee_id: $fee->getId(),
                amount: $amount,
            ));
        });

        $product->getTaxRates()?->each(function (TaxAndFeesDomainObject $tax) use ($price, $feeTotal, $taxesAndFees) {
            $taxesAndFees->push(new CreateAttendeeTaxAndFeeDTO(
                tax_or_fee_id: $tax->getId(),
                amount: $this->amountFor($tax, $price + $feeTotal),
            ));
        });

        return $taxesAndFees;
    }

    /**
     * @return Collection<int, AvailableProductQuantitiesDTO>
     */
    public function getAvailableQuantities(int $eventId): Collection
    {
        return $this->availableProductQuantitiesFetchService
            ->getAvailableProductQuantities($eventId, ignoreCache: true)
            ->productQuantities;
    }

    public function getQuantityRemaining(int $eventId, int $productPriceId): int
    {
        return max(
            $this->getAvailableQuantities($eventId)->firstWhere('price_id', $productPriceId)?->quantity_available ?? 0,
            0
        );
    }

    private function amountFor(TaxAndFeesDomainObject $taxOrFee, float $price): float
    {
        if ($price === 0.0) {
            return 0.0;
        }

        return match ($taxOrFee->getCalculationType()) {
            TaxCalculationType::FIXED->name => $taxOrFee->getRate(),
            default => ($price * $taxOrFee->getRate()) / 100,
        };
    }
}
