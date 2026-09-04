<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Square;

use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;
use HiEvents\DomainObjects\Generated\SquarePaymentDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\SquarePaymentDomainObject;
use HiEvents\Exceptions\Square\CreateSquarePaymentFailedException;
use HiEvents\Exceptions\Square\SquareApiException;
use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Helper\Currency;
use HiEvents\Repository\Interfaces\SquarePaymentsRepositoryInterface;
use HiEvents\Services\Infrastructure\Square\SquareClientFactory;
use HiEvents\Services\Infrastructure\Square\SquareConfigurationService;
use Illuminate\Config\Repository;
use Illuminate\Support\Str;
use Psr\Log\LoggerInterface;

/**
 * Encaissement d'une commande via Square.
 *
 * Square n'a pas d'equivalent du PaymentIntent: le paiement est cree et capture
 * en un seul appel, avec le jeton de carte produit par le SDK Web Payments dans
 * le navigateur. La reponse dit immediatement si l'argent est pris, il n'y a
 * donc pas d'attente de webhook pour completer la commande.
 */
class SquarePaymentService
{
    public function __construct(
        private readonly SquareClientFactory               $clientFactory,
        private readonly SquareConfigurationService        $configurationService,
        private readonly SquarePaymentsRepositoryInterface $squarePaymentsRepository,
        private readonly SquareOAuthService                $oAuthService,
        private readonly Repository                        $config,
        private readonly LoggerInterface                   $logger,
    )
    {
    }

    /**
     * @throws CreateSquarePaymentFailedException|SquareNotConnectedException
     */
    public function charge(
        OrderDomainObject                    $order,
        ?AccountSquareCredentialDomainObject $credential,
        string                               $sourceId,
        ?string                              $verificationToken = null,
    ): SquarePaymentDomainObject
    {
        $locationId = $credential?->getLocationId() ?? $this->configurationService->getFallbackLocationId();

        if ($locationId === null) {
            throw new SquareNotConnectedException(
                __('Square is not fully configured for this event. No location has been selected.')
            );
        }

        $credential = $this->oAuthService->ensureFreshTokens($credential);

        // La cle d'idempotence est posee AVANT l'appel et conservee: si la
        // reponse se perd en route, rejouer la meme cle renvoie le paiement deja
        // cree au lieu de debiter l'acheteur une seconde fois.
        $pending = $this->findOrCreatePendingPayment($order, $locationId, $credential);

        $payload = [
            'source_id' => $sourceId,
            'idempotency_key' => $pending->getIdempotencyKey(),
            'amount_money' => [
                'amount' => (int)round(Currency::round($order->getTotalGross()) * 100),
                'currency' => strtoupper($order->getCurrency()),
            ],
            'location_id' => $locationId,
            'reference_id' => $order->getShortId(),
            'note' => Str::limit(__('Order :short_id', ['short_id' => $order->getShortId()]), 60),
            'autocomplete' => true,
        ];

        if ($verificationToken !== null) {
            $payload['verification_token'] = $verificationToken;
        }

        $applicationFee = $this->applicationFeeMinorUnit($order);

        // app_fee_money n'existe que sur un marchand autorise via OAuth: sur une
        // installation mono-marchand, l'argent est deja sur le compte de la
        // plateforme et Square rejette le champ.
        if ($applicationFee > 0 && $credential !== null) {
            $payload['app_fee_money'] = [
                'amount' => $applicationFee,
                'currency' => strtoupper($order->getCurrency()),
            ];
        }

        try {
            $response = $this->clientFactory->createForCredential($credential)->createPayment($payload);
        } catch (SquareApiException $exception) {
            $this->squarePaymentsRepository->updateFromArray($pending->getId(), [
                SquarePaymentDomainObjectAbstract::LAST_ERROR => ['message' => $exception->getMessage()],
            ]);

            $this->logger->error('Square payment failed: ' . $exception->getMessage(), [
                'order_id' => $order->getId(),
            ]);

            throw new CreateSquarePaymentFailedException($exception->getMessage(), previous: $exception);
        }

        return $this->storePaymentResult($pending->getId(), $response, $applicationFee);
    }

    /**
     * La contribution volontaire ne doit rien couter a l'organisateur: la
     * plateforme lui rend la part variable des frais Square qu'elle ajoute.
     */
    public function applicationFeeMinorUnit(OrderDomainObject $order): int
    {
        $contribution = (float)$order->getPlatformContribution();

        if ($contribution <= 0) {
            return 0;
        }

        $contributionMinorUnit = (int)round(Currency::round($contribution) * 100);
        $percentage = (float)$this->config->get('services.square.processing_fee_percentage', 0);

        if ($percentage <= 0) {
            return $contributionMinorUnit;
        }

        return max(0, $contributionMinorUnit - (int)round($contributionMinorUnit * $percentage / 100));
    }

    private function findOrCreatePendingPayment(
        OrderDomainObject                    $order,
        string                               $locationId,
        ?AccountSquareCredentialDomainObject $credential,
    ): SquarePaymentDomainObject
    {
        $existing = $this->squarePaymentsRepository->findFirstWhere([
            SquarePaymentDomainObjectAbstract::ORDER_ID => $order->getId(),
        ]);

        if ($existing !== null) {
            return $existing;
        }

        return $this->squarePaymentsRepository->create([
            SquarePaymentDomainObjectAbstract::ORDER_ID => $order->getId(),
            SquarePaymentDomainObjectAbstract::IDEMPOTENCY_KEY => (string)Str::uuid(),
            SquarePaymentDomainObjectAbstract::LOCATION_ID => $locationId,
            SquarePaymentDomainObjectAbstract::MERCHANT_ID => $credential?->getMerchantId(),
            SquarePaymentDomainObjectAbstract::CURRENCY => strtoupper($order->getCurrency()),
        ]);
    }

    private function storePaymentResult(int $paymentId, array $response, int $applicationFee): SquarePaymentDomainObject
    {
        $payment = $response['payment'] ?? [];
        $card = $payment['card_details']['card'] ?? [];

        return $this->squarePaymentsRepository->updateFromArray($paymentId, [
            SquarePaymentDomainObjectAbstract::SQUARE_PAYMENT_ID => $payment['id'] ?? null,
            SquarePaymentDomainObjectAbstract::SQUARE_ORDER_ID => $payment['order_id'] ?? null,
            SquarePaymentDomainObjectAbstract::STATUS => $payment['status'] ?? null,
            SquarePaymentDomainObjectAbstract::AMOUNT_RECEIVED => $payment['amount_money']['amount'] ?? null,
            SquarePaymentDomainObjectAbstract::RECEIPT_URL => $payment['receipt_url'] ?? null,
            SquarePaymentDomainObjectAbstract::CARD_BRAND => $card['card_brand'] ?? null,
            SquarePaymentDomainObjectAbstract::CARD_LAST_4 => $card['last_4'] ?? null,
            SquarePaymentDomainObjectAbstract::PROCESSING_FEE => $this->extractProcessingFee($payment),
            SquarePaymentDomainObjectAbstract::APPLICATION_FEE_GROSS => $applicationFee,
            SquarePaymentDomainObjectAbstract::LAST_ERROR => null,
        ]);
    }

    /**
     * Square ne connait ses propres frais qu'apres coup: le champ est souvent
     * absent de la reponse immediate et arrive par webhook plus tard.
     */
    private function extractProcessingFee(array $payment): ?int
    {
        $fees = $payment['processing_fee'] ?? [];

        if ($fees === []) {
            return null;
        }

        return array_sum(array_map(
            static fn(array $fee) => (int)($fee['amount_money']['amount'] ?? 0),
            $fees,
        ));
    }
}
