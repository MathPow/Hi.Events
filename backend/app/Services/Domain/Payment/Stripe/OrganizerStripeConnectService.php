<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Stripe;

use HiEvents\DomainObjects\Enums\StripeConnectAccountType;
use HiEvents\DomainObjects\Generated\OrganizerStripePlatformDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerStripePlatformDomainObject;
use HiEvents\Exceptions\CreateStripeConnectAccountFailedException;
use HiEvents\Helper\Url;
use HiEvents\Exceptions\CreateStripeConnectAccountLinksFailedException;
use HiEvents\Repository\Interfaces\OrganizerStripePlatformRepositoryInterface;
use HiEvents\Services\Domain\Payment\Stripe\DTOs\OrganizerStripeConnectionDTO;
use HiEvents\Services\Infrastructure\Stripe\StripeClientFactory;
use HiEvents\Services\Infrastructure\Stripe\StripeConfigurationService;
use Illuminate\Config\Repository;
use Psr\Log\LoggerInterface;
use Stripe\Account;
use Stripe\StripeClient;
use Throwable;

/**
 * Connexion Stripe d'un organisateur, sur le modele de celle du compte.
 *
 * Le compte connecte est cree par la plateforme mais appartient a
 * l'organisateur: l'argent des ventes arrive chez lui, la billetterie ne
 * prelevant que sa commission via application_fee_amount.
 */
class OrganizerStripeConnectService
{
    public function __construct(
        private readonly OrganizerStripePlatformRepositoryInterface $organizerStripePlatformRepository,
        private readonly StripeClientFactory                        $stripeClientFactory,
        private readonly StripeConfigurationService                 $stripeConfigurationService,
        private readonly StripeAccountSyncService                   $stripeAccountSyncService,
        private readonly Repository                                 $config,
        private readonly LoggerInterface                            $logger,
    )
    {
    }

    public function getConnection(int $organizerId): OrganizerStripeConnectionDTO
    {
        $platform = $this->findPlatform($organizerId);

        return new OrganizerStripeConnectionDTO(
            stripeAccountId: $platform?->getStripeAccountId(),
            isSetupComplete: $platform?->isSetupComplete() ?? false,
            connectUrl: null,
        );
    }

    /**
     * Cree le compte connecte s'il n'existe pas, et renvoie le lien d'onboarding
     * tant que Stripe ne considere pas le compte pret a encaisser.
     *
     * @throws CreateStripeConnectAccountFailedException
     * @throws CreateStripeConnectAccountLinksFailedException
     */
    public function connect(OrganizerDomainObject $organizer): OrganizerStripeConnectionDTO
    {
        $existing = $this->findPlatform($organizer->getId());
        $stripePlatform = $existing?->getStripePlatformEnum()
            ?? $this->stripeConfigurationService->getPrimaryPlatform();
        $stripeClient = $this->stripeClientFactory->createForPlatform($stripePlatform);

        $stripeAccount = $this->getOrCreateStripeAccount($organizer, $existing, $stripeClient);

        $platform = $existing ?? $this->organizerStripePlatformRepository->create([
            OrganizerStripePlatformDomainObjectAbstract::ORGANIZER_ID => $organizer->getId(),
            OrganizerStripePlatformDomainObjectAbstract::STRIPE_ACCOUNT_ID => $stripeAccount->id,
            OrganizerStripePlatformDomainObjectAbstract::STRIPE_CONNECT_ACCOUNT_TYPE => $stripeAccount->type,
            OrganizerStripePlatformDomainObjectAbstract::STRIPE_CONNECT_PLATFORM => $stripePlatform?->value,
        ]);

        if ($this->stripeAccountSyncService->isStripeAccountComplete($stripeAccount)) {
            $this->markComplete($platform, $stripeAccount);

            return new OrganizerStripeConnectionDTO(
                stripeAccountId: $stripeAccount->id,
                isSetupComplete: true,
                connectUrl: null,
            );
        }

        $connectUrl = $this->createOnboardingUrl($organizer->getId(), $stripeAccount, $stripeClient);

        if ($connectUrl === null) {
            throw new CreateStripeConnectAccountLinksFailedException(
                __('Could not create the Stripe onboarding link. Please try again.')
            );
        }

        return new OrganizerStripeConnectionDTO(
            stripeAccountId: $stripeAccount->id,
            isSetupComplete: false,
            connectUrl: $connectUrl,
        );
    }

    /**
     * Relit l'etat chez Stripe: l'onboarding se termine sur le site de Stripe,
     * sans que rien ne nous en informe si le webhook manque.
     */
    public function refreshStatus(int $organizerId): OrganizerStripeConnectionDTO
    {
        $platform = $this->findPlatform($organizerId);

        if ($platform?->getStripeAccountId() === null) {
            return new OrganizerStripeConnectionDTO(null, false, null);
        }

        try {
            $stripeAccount = $this->stripeClientFactory
                ->createForPlatform($platform->getStripePlatformEnum())
                ->accounts
                ->retrieve($platform->getStripeAccountId());
        } catch (Throwable $exception) {
            $this->logger->warning('Could not refresh organizer Stripe account: ' . $exception->getMessage(), [
                'organizer_id' => $organizerId,
            ]);

            return $this->getConnection($organizerId);
        }

        if ($this->stripeAccountSyncService->isStripeAccountComplete($stripeAccount)) {
            $this->markComplete($platform, $stripeAccount);

            return new OrganizerStripeConnectionDTO($stripeAccount->id, true, null);
        }

        return new OrganizerStripeConnectionDTO($stripeAccount->id, false, null);
    }

    /**
     * On oublie la connexion sans supprimer le compte chez Stripe: les
     * paiements deja encaisses y vivent, et leurs remboursements en dependent.
     */
    public function disconnect(int $organizerId): void
    {
        $platform = $this->findPlatform($organizerId);

        if ($platform !== null) {
            $this->organizerStripePlatformRepository->deleteById($platform->getId());
        }
    }

    public function findPlatform(int $organizerId): ?OrganizerStripePlatformDomainObject
    {
        return $this->organizerStripePlatformRepository->findFirstWhere([
            OrganizerStripePlatformDomainObjectAbstract::ORGANIZER_ID => $organizerId,
        ]);
    }

    /**
     * @throws CreateStripeConnectAccountFailedException
     */
    private function getOrCreateStripeAccount(
        OrganizerDomainObject                $organizer,
        ?OrganizerStripePlatformDomainObject $existing,
        StripeClient                         $stripeClient,
    ): Account
    {
        try {
            if ($existing?->getStripeAccountId() !== null) {
                return $stripeClient->accounts->retrieve($existing->getStripeAccountId());
            }

            return $stripeClient->accounts->create([
                'type' => $this->config->get('app.stripe_connect_account_type')
                    ?? StripeConnectAccountType::EXPRESS->value,
                'email' => $organizer->getEmail(),
                'business_profile' => [
                    'name' => $organizer->getName(),
                ],
                'metadata' => [
                    'hi_events_organizer_id' => (string)$organizer->getId(),
                ],
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('Failed to create the organizer Stripe Connect account: ' . $exception->getMessage(), [
                'organizer_id' => $organizer->getId(),
            ]);

            throw new CreateStripeConnectAccountFailedException(
                message: __('Could not create the Stripe account. Please try again.'),
                previous: $exception,
            );
        }
    }

    /**
     * Lien d'onboarding renvoyant vers les reglages de CET organisateur: le lien
     * partage par le compte ramenerait le client sur une page de reglages qui
     * n'est pas la sienne, et a laquelle il n'a pas forcement acces.
     */
    private function createOnboardingUrl(int $organizerId, Account $stripeAccount, StripeClient $stripeClient): ?string
    {
        try {
            $accountLink = $stripeClient->accountLinks->create([
                'account' => $stripeAccount->id,
                'refresh_url' => sprintf(
                    Url::getFrontEndUrlFromConfig(Url::ORGANIZER_STRIPE_REFRESH),
                    $organizerId,
                ),
                'return_url' => sprintf(
                    Url::getFrontEndUrlFromConfig(Url::ORGANIZER_STRIPE_RETURN),
                    $organizerId,
                ),
                'type' => 'account_onboarding',
            ]);

            return $accountLink->url;
        } catch (Throwable $exception) {
            $this->logger->error('Failed to create the organizer Stripe onboarding link', [
                'organizer_id' => $organizerId,
                'stripe_account_id' => $stripeAccount->id,
                'error' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    private function markComplete(OrganizerStripePlatformDomainObject $platform, Account $stripeAccount): void
    {
        $this->organizerStripePlatformRepository->updateFromArray($platform->getId(), [
            OrganizerStripePlatformDomainObjectAbstract::STRIPE_SETUP_COMPLETED_AT => now()->toDateTimeString(),
            OrganizerStripePlatformDomainObjectAbstract::STRIPE_ACCOUNT_ID => $stripeAccount->id,
            OrganizerStripePlatformDomainObjectAbstract::STRIPE_CONNECT_ACCOUNT_TYPE => $stripeAccount->type,
            OrganizerStripePlatformDomainObjectAbstract::STRIPE_ACCOUNT_DETAILS => [
                'country' => $stripeAccount->country,
                'charges_enabled' => $stripeAccount->charges_enabled,
                'payouts_enabled' => $stripeAccount->payouts_enabled,
                'business_name' => $stripeAccount->business_profile?->name,
            ],
        ]);
    }
}
