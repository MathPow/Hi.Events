<?php

namespace HiEvents\Services\Domain\Event;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\AccountStripePlatformDomainObject;
use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\Enums\ProductPriceType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Exceptions\EventNotReadyToPublishException;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductPriceRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Services\Domain\Payment\Stripe\StripePayeeResolutionService;
use Illuminate\Config\Repository as ConfigRepository;

/**
 * Un evenement ne passe en ligne que si un acheteur peut aller jusqu'au bout: au moins un
 * produit, et pour un produit payant, un moyen d'etre paye (la meme regle que
 * CreatePaymentIntentHandler).
 */
class EventPublishReadinessService
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly ProductPriceRepositoryInterface $productPriceRepository,
        private readonly EventSettingsRepositoryInterface $eventSettingsRepository,
        private readonly AccountRepositoryInterface $accountRepository,
        private readonly StripePayeeResolutionService $payeeResolutionService,
        private readonly ConfigRepository $config,
    ) {}

    /**
     * @throws EventNotReadyToPublishException
     */
    public function assertCanPublish(EventDomainObject $event): void
    {
        $products = $this->productRepository->findWhere(['event_id' => $event->getId()]);

        if ($products->isEmpty()) {
            throw new EventNotReadyToPublishException(
                __('Add at least one ticket before publishing this event.'),
                EventNotReadyToPublishException::NO_PRODUCTS,
            );
        }

        if (! $this->hasPaidProduct($products->all())) {
            return;
        }

        /** @var EventSettingDomainObject|null $settings */
        $settings = $this->eventSettingsRepository->findFirstWhere(['event_id' => $event->getId()]);
        $providers = (array) ($settings?->getPaymentProviders() ?? [PaymentProviders::STRIPE->value]);

        if ($providers === []) {
            throw new EventNotReadyToPublishException(
                __('Turn on a payment method for this event before publishing it: buyers could not pay for its tickets.'),
                EventNotReadyToPublishException::NO_PAYMENT_METHOD,
            );
        }

        if (in_array(PaymentProviders::OFFLINE->value, $providers, true)
            || ! in_array(PaymentProviders::STRIPE->value, $providers, true)) {
            return;
        }

        /** @var AccountDomainObject $account */
        $account = $this->accountRepository
            ->loadRelation(AccountStripePlatformDomainObject::class)
            ->findById($event->getAccountId());

        $payee = $this->payeeResolutionService->resolveForOrganizer($event->getOrganizerId(), $account);
        $chargesPlatformAccount = ! $this->config->get('app.saas_mode_enabled') || $payee->stripeAccountId === null;

        if ($chargesPlatformAccount && ! $account->getPlatformPaymentsAllowed()) {
            throw new EventNotReadyToPublishException(
                __('Connect Stripe before publishing this event: buyers could not pay for its tickets.'),
                EventNotReadyToPublishException::PAYMENTS_NOT_READY,
            );
        }
    }

    /**
     * @param  ProductDomainObject[]  $products
     */
    private function hasPaidProduct(array $products): bool
    {
        $byId = [];
        foreach ($products as $product) {
            if ($product->getType() === ProductPriceType::DONATION->name) {
                return true;
            }
            $byId[$product->getId()] = $product;
        }

        return $this->productPriceRepository
            ->findWhereIn('product_id', array_keys($byId))
            ->contains(fn (ProductPriceDomainObject $price) => $price->getPrice() > 0);
    }
}
