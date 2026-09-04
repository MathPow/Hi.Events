<?php

namespace HiEvents\Services\Domain\Payment\Stripe;

use HiEvents\DomainObjects\StripeCustomerDomainObject;
use HiEvents\Exceptions\Stripe\CreatePaymentIntentFailedException;
use HiEvents\Values\MoneyValue;
use HiEvents\Repository\Interfaces\StripeCustomerRepositoryInterface;
use HiEvents\Services\Domain\Order\DTO\ApplicationFeeValuesDTO;
use HiEvents\Services\Domain\Order\OrderApplicationFeeCalculationService;
use HiEvents\Services\Domain\Payment\Stripe\DTOs\CreatePaymentIntentRequestDTO;
use HiEvents\Services\Domain\Payment\Stripe\DTOs\CreatePaymentIntentResponseDTO;
use Illuminate\Config\Repository;
use Illuminate\Database\DatabaseManager;
use Psr\Log\LoggerInterface;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;
use Throwable;

class StripePaymentIntentCreationService
{
    public function __construct(
        private readonly LoggerInterface                       $logger,
        private readonly Repository                            $config,
        private readonly StripeCustomerRepositoryInterface     $stripeCustomerRepository,
        private readonly DatabaseManager                       $databaseManager,
        private readonly OrderApplicationFeeCalculationService $orderApplicationFeeCalculationService,
    )
    {
    }

    /**
     * @throws CreatePaymentIntentFailedException
     */
    public function retrievePaymentIntentClientSecretWithClient(
        StripeClient $stripeClient,
        string       $paymentIntentId,
        ?string      $accountId = null,
    ): string
    {
        try {
            return $stripeClient->paymentIntents->retrieve(
                id: $paymentIntentId,
                opts: $accountId ? ['stripe_account' => $accountId] : []
            )->client_secret;
        } catch (ApiErrorException $exception) {
            $this->logger->error("Stripe payment intent retrieval failed: {$exception->getMessage()}", [
                'exception' => $exception,
                'paymentIntentId' => $paymentIntentId,
            ]);

            throw new CreatePaymentIntentFailedException(
                __('There was an error communicating with the payment provider. Please try again later.')
            );
        }
    }

    /**
     * @throws CreatePaymentIntentFailedException
     * @throws ApiErrorException|Throwable
     */
    public function createPaymentIntentWithClient(
        StripeClient                  $stripeClient,
        CreatePaymentIntentRequestDTO $paymentIntentDTO
    ): CreatePaymentIntentResponseDTO
    {
        try {
            $this->databaseManager->beginTransaction();

            $accountConfiguration = $paymentIntentDTO->account->getConfiguration();
            $bypassApplicationFees = $accountConfiguration?->getBypassApplicationFees() ?? false;

            $applicationFee = $this->orderApplicationFeeCalculationService->calculateApplicationFee(
                accountConfiguration: $accountConfiguration,
                order: $paymentIntentDTO->order,
                vatSettings: $paymentIntentDTO->vatSettings,
            );

            $paymentIntent = $stripeClient->paymentIntents->create([
                'amount' => $paymentIntentDTO->amount->toMinorUnit(),
                'currency' => $paymentIntentDTO->currencyCode,
                'customer' => $this->upsertStripeCustomerWithClient($stripeClient, $paymentIntentDTO)->getStripeCustomerId(),
                'metadata' => $this->getPaymentIntentMetadata($paymentIntentDTO, $applicationFee),
                'automatic_payment_methods' => [
                    'enabled' => true,
                ],
                ...($paymentIntentDTO->description ? ['description' => $paymentIntentDTO->description] : []),
                // Une commission plateforme n'a de sens QUE sur une charge portee par
                // un compte connecte. Sur le compte de la plateforme, l'encaissement est
                // deja integralement le sien, et Stripe rejette la requete.
                ...($this->applicationFeeAmount($paymentIntentDTO, $applicationFee, $bypassApplicationFees)),
            ], $this->getStripeAccountData($paymentIntentDTO));

            $this->logger->debug('Stripe payment intent created', [
                'paymentIntentId' => $paymentIntent->id,
                'paymentIntentDTO' => $paymentIntentDTO->toArray(['account']),
            ]);

            $this->databaseManager->commit();

            return new CreatePaymentIntentResponseDTO(
                paymentIntentId: $paymentIntent->id,
                clientSecret: $paymentIntent->client_secret,
                accountId: $paymentIntentDTO->stripeAccountId,
                applicationFeeData: $applicationFee,
            );
        } catch (ApiErrorException $exception) {
            $this->logger->error("Stripe payment intent creation failed: {$exception->getMessage()}", [
                'exception' => $exception,
                'paymentIntentDTO' => $paymentIntentDTO->toArray(['account']),
            ]);

            $this->databaseManager->rollBack();

            throw new CreatePaymentIntentFailedException(
                __('There was an error communicating with the payment provider. Please try again later.')
            );
        } catch (Throwable $exception) {
            $this->databaseManager->rollBack();

            throw $exception;
        }
    }

    /**
     * @throws CreatePaymentIntentFailedException
     */
    private function getStripeAccountData(CreatePaymentIntentRequestDTO $paymentIntentDTO): array
    {
        if (!$this->config->get('app.saas_mode_enabled')) {
            return [];
        }

        // Organisation sans compte Stripe Connect: on encaisse sur le compte de la
        // PLATEFORME plutot que de refuser la vente. Sans ce repli, tout billet
        // payant d'un organisateur pas encore branche echoue au checkout, et le
        // client ne voit qu'une erreur de paiement generique.
        //
        // Contrepartie assumee: l'argent atterrit dans le solde de la plateforme,
        // c'est donc a elle de reverser l'organisateur a la main.
        if ($paymentIntentDTO->stripeAccountId === null) {
            $this->logger->info(
                'No Stripe Connect account for the event organizer, charging the platform account instead.',
                ['paymentIntentDTO' => $paymentIntentDTO->toArray(['account'])]
            );

            return [];
        }

        return [
            'stripe_account' => $paymentIntentDTO->stripeAccountId
        ];
    }

    /**
     * @throws ApiErrorException|CreatePaymentIntentFailedException
     */
    private function upsertStripeCustomerWithClient(
        StripeClient                  $stripeClient,
        CreatePaymentIntentRequestDTO $paymentIntentDTO
    ): StripeCustomerDomainObject
    {
        $customer = $this->stripeCustomerRepository->findFirstWhere([
            'email' => $paymentIntentDTO->order->getEmail(),
            'stripe_account_id' => $paymentIntentDTO->stripeAccountId,
        ]);

        if ($customer === null) {
            $order = $paymentIntentDTO->order;

            $customerData = [
                'email' => $order->getEmail(),
                'name' => $order->getFullName(),
            ];

            if (($address = $order->getAddressDTO()) && $address->address_line_1 && $address->country) {
                $customerData['address'] = [
                    'line1' => $address->address_line_1,
                    'line2' => $address->address_line_2 ?? '',
                    'city' => $address->city ?? '',
                    'state' => $address->state_or_region ?? '',
                    'postal_code' => $address->zip_or_postal_code ?? '',
                    'country' => $address->country,
                ];
            }

            $stripeCustomer = $stripeClient->customers->create(
                params: $customerData,
                opts: $this->getStripeAccountData($paymentIntentDTO)
            );

            return $this->stripeCustomerRepository->create([
                'name' => $stripeCustomer->name,
                'email' => $stripeCustomer->email,
                'stripe_customer_id' => $stripeCustomer->id,
                'stripe_account_id' => $paymentIntentDTO->stripeAccountId,
            ]);
        }

        if ($customer->getName() === $paymentIntentDTO->order->getFullName()) {
            return $customer;
        }

        $stripeCustomer = $stripeClient->customers->update(
            id: $customer->getStripeCustomerId(),
            params: ['name' => $paymentIntentDTO->order->getFullName()],
            opts: $this->getStripeAccountData($paymentIntentDTO),
        );

        $this->stripeCustomerRepository->updateFromArray($customer->getId(), [
            'name' => $stripeCustomer->name,
        ]);

        return $customer;
    }

    private function getPaymentIntentMetadata(
        CreatePaymentIntentRequestDTO $paymentIntentDTO,
        ?ApplicationFeeValuesDTO      $applicationFee
    ): array
    {
        $metaData = [
            'order_id' => $paymentIntentDTO->order->getId(),
            'event_id' => $paymentIntentDTO->order->getEventId(),
            'order_short_id' => $paymentIntentDTO->order->getShortId(),
            'account_id' => $paymentIntentDTO->account->getId(),

        ];

        if ($applicationFee) {
            $metaData['application_fee_gross_amount'] = $applicationFee->grossApplicationFee?->toFloat();
            $metaData['application_fee_vat_amount'] = $applicationFee->applicationFeeVatAmount?->toFloat();
            $metaData['application_fee_net_amount'] = $applicationFee->netApplicationFee?->toFloat();
            $metaData['application_fee_vat_rate'] = $applicationFee->applicationFeeVatRate;
        }

        return $metaData;
    }

    /**
     * Commission plateforme + contribution volontaire de l'acheteur.
     *
     * La contribution s'ajoute a la commission parce que, sur une charge directe
     * portee par le compte connecte de l'organisateur, application_fee_amount est
     * le seul canal qui ramene de l'argent a la plateforme.
     *
     * Sans compte connecte, la charge est deja sur le compte de la plateforme:
     * l'argent y est, et Stripe refuse application_fee_amount dans ce cas.
     */
    private function applicationFeeAmount(
        CreatePaymentIntentRequestDTO $paymentIntentDTO,
        ?ApplicationFeeValuesDTO      $applicationFee,
        bool                          $bypassApplicationFees
    ): array
    {
        if ($paymentIntentDTO->stripeAccountId === null) {
            return [];
        }

        $feeMinorUnit = ($applicationFee && !$bypassApplicationFees)
            ? $applicationFee->grossApplicationFee->toMinorUnit()
            : 0;

        $contribution = $paymentIntentDTO->order->getPlatformContribution();

        $contributionMinorUnit = $contribution > 0
            ? MoneyValue::fromFloat($contribution, $paymentIntentDTO->currencyCode)->toMinorUnit()
            : 0;

        $total = $feeMinorUnit + $this->contributionNetOfProcessing($contributionMinorUnit);

        return $total > 0 ? ['application_fee_amount' => $total] : [];
    }

    /**
     * La contribution n'est pas l'argent de l'organisateur, elle ne doit donc
     * rien lui couter. Sur une charge directe, Stripe preleve ses frais sur le
     * compte connecte pour la totalite du montant: la plateforme rend la part
     * variable qui porte sur la contribution, et l'organisateur touche
     * exactement ce qu'il aurait touche sans elle.
     *
     * La part fixe (0,30 $) n'entre pas dans le calcul: elle est due une fois
     * par transaction, contribution ou pas.
     */
    private function contributionNetOfProcessing(int $contributionMinorUnit): int
    {
        if ($contributionMinorUnit <= 0) {
            return 0;
        }

        $percentage = (float)$this->config->get('services.stripe.processing_fee_percentage', 0);

        if ($percentage <= 0) {
            return $contributionMinorUnit;
        }

        $processingCost = (int)round($contributionMinorUnit * $percentage / 100);

        return max(0, $contributionMinorUnit - $processingCost);
    }
}
