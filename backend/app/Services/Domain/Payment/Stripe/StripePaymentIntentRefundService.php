<?php

namespace HiEvents\Services\Domain\Payment\Stripe;

use Brick\Math\Exception\MathException;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Values\MoneyValue;
use Illuminate\Config\Repository;
use Psr\Log\LoggerInterface;
use Stripe\Exception\ApiErrorException;
use Stripe\Refund;
use Stripe\StripeClient;

class StripePaymentIntentRefundService
{
    public function __construct(
        private readonly Repository      $config,
        private readonly LoggerInterface $logger,
    )
    {
    }

    /**
     * @throws ApiErrorException
     * @throws MathException
     * @todo - catch and handle stripe errors
     */
    public function refundPayment(
        MoneyValue                $amount,
        StripePaymentDomainObject $payment,
        StripeClient              $stripeClient,
    ): Refund
    {
        $accountData = $this->getStripeAccountData($payment);

        return $stripeClient->refunds->create(
            params: [
                'payment_intent' => $payment->getPaymentIntentId(),
                'amount' => $amount->toMinorUnit(),
                // La commission plateforme et la contribution volontaire vivent dans
                // application_fee_amount, donc dans le solde de la PLATEFORME. Sans ce
                // drapeau, l'organisateur rend la totalite du montant debite alors que
                // la plateforme garde sa part: il rembourse de sa poche une somme qu'il
                // n'a jamais recue. Stripe reverse la commission au prorata du montant
                // rembourse, ce qui couvre aussi les remboursements partiels.
                ...($this->shouldRefundApplicationFee($payment, $stripeClient, $accountData)
                    ? ['refund_application_fee' => true]
                    : []),
            ],
            opts: $accountData,
        );
    }

    private function getStripeAccountData(StripePaymentDomainObject $payment): array
    {
        if (!$this->config->get('app.saas_mode_enabled')) {
            return [];
        }

        // Un paiement sans compte connecte a ete encaisse sur le compte de la PLATEFORME
        // (organisateur pas encore branche a Stripe Connect, cf. StripePaymentIntentCreationService).
        // La charge vit donc sur le compte de la plateforme et le remboursement doit partir
        // du meme endroit. Refuser ici rendrait ces commandes definitivement non remboursables,
        // et ferait echouer le remboursement automatique d'une commande expiree, laissant
        // l'acheteur debite sans billet.
        if ($payment->getConnectedAccountId() === null) {
            $this->logger->info('Refunding a payment charged on the platform account', [
                'payment_intent_id' => $payment->getPaymentIntentId(),
                'order_id' => $payment->getOrderId(),
            ]);

            return [];
        }

        return [
            'stripe_account' => $payment->getConnectedAccountId(),
        ];
    }

    /**
     * Une commission plateforme n'existe que sur une charge directe portee par un compte
     * connecte. Sur le compte de la plateforme, l'encaissement lui revient deja en entier:
     * il n'y a rien a reverser.
     */
    private function shouldRefundApplicationFee(
        StripePaymentDomainObject $payment,
        StripeClient              $stripeClient,
        array                     $accountData
    ): bool
    {
        if ($accountData === []) {
            return false;
        }

        // application_fee_gross ne compte que la commission: elle ignore la contribution
        // volontaire de l'acheteur et vaut 0 quand la commission est desactivee pour le
        // compte. On lit donc ce qui a reellement ete preleve sur le PaymentIntent.
        try {
            $paymentIntent = $stripeClient->paymentIntents->retrieve(
                id: $payment->getPaymentIntentId(),
                opts: $accountData,
            );

            return ($paymentIntent->application_fee_amount ?? 0) > 0;
        } catch (ApiErrorException $exception) {
            $this->logger->warning(
                "Could not read the application fee before refunding: {$exception->getMessage()}",
                [
                    'exception' => $exception,
                    'payment_intent_id' => $payment->getPaymentIntentId(),
                ]
            );

            // Un echec de lecture ne doit pas bloquer un remboursement: on retombe sur la
            // commission enregistree a la creation du paiement.
            return $payment->getApplicationFeeGross() > 0;
        }
    }
}
