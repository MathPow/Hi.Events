<?php

namespace HiEvents\Services\Domain\DonationReceipt;

use HiEvents\DomainObjects\DonationReceiptDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\DomainObjects\Status\DonationReceiptStatus;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\DonationReceiptRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use Illuminate\Database\DatabaseManager;
use Psr\Log\LoggerInterface;

/**
 * Emission d'un recu officiel aux fins de l'impot pour une commande.
 *
 * Trois conditions doivent etre reunies, sinon on ne fait rien silencieusement:
 *   1. l'organisateur a un numero d'enregistrement d'organisme (l'interrupteur);
 *   2. la commande contient une part de don admissible;
 *   3. aucun recu ISSUED n'existe deja pour cette commande.
 */
class DonationReceiptCreateService
{
    public function __construct(
        private readonly OrderRepositoryInterface           $orderRepository,
        private readonly DonationReceiptRepositoryInterface $donationReceiptRepository,
        private readonly DonationBreakdownService           $donationBreakdownService,
        private readonly DatabaseManager                    $databaseManager,
        private readonly LoggerInterface                    $logger,
    )
    {
    }

    public function createReceiptForOrder(int $orderId): ?DonationReceiptDomainObject
    {
        $order = $this->orderRepository
            ->loadRelation(OrderItemDomainObject::class)
            ->loadRelation(new Relationship(EventDomainObject::class, nested: [
                new Relationship(OrganizerDomainObject::class, nested: [
                    new Relationship(OrganizerSettingDomainObject::class, name: 'organizer_settings'),
                ], name: 'organizer'),
            ], name: 'event'))
            ->findById($orderId);

        $organizer = $order->getEvent()?->getOrganizer();
        $settings = $organizer?->getOrganizerSettings();

        $registrationNumber = trim((string)$settings?->getCharityRegistrationNumber());

        if ($organizer === null || $registrationNumber === '') {
            return null;
        }

        if ($this->donationReceiptRepository->findIssuedForOrder($orderId) !== null) {
            return null;
        }

        $breakdown = $this->donationBreakdownService->calculateForOrder($order);

        if (!$breakdown->hasReceiptableGift()) {
            return null;
        }

        // La transaction couvre « lire le dernier numero » et « inserer le
        // suivant ». Sans elle, deux commandes payees simultanement liraient le
        // meme numero; l'index unique (organizer_id, receipt_number) ferait
        // alors echouer la seconde insertion.
        return $this->databaseManager->transaction(function () use (
            $order, $organizer, $settings, $registrationNumber, $breakdown
        ) {
            $year = (int)now()->format('Y');

            $receipt = $this->donationReceiptRepository->create([
                'order_id' => $order->getId(),
                'organizer_id' => $organizer->getId(),
                'receipt_number' => $this->nextReceiptNumber($organizer->getId(), $year, $settings),
                'receipt_year' => $year,
                'issue_date' => now()->toDateString(),
                'donation_date' => ($order->getCreatedAt() ? substr($order->getCreatedAt(), 0, 10) : now()->toDateString()),
                'donor_name' => trim($order->getFirstName() . ' ' . $order->getLastName()),
                'donor_address' => $this->formatDonorAddress($order),
                'total_received' => $breakdown->totalReceived,
                'advantage_amount' => $breakdown->advantageAmount,
                'eligible_amount' => $breakdown->eligibleAmount,
                'currency' => strtoupper($order->getCurrency()),
                'charity_registration_number' => $registrationNumber,
                'charity_legal_name' => $settings?->getCharityLegalName() ?: $organizer->getName(),
                'charity_address' => $settings?->getCharityAddress(),
                'charity_signatory_name' => $settings?->getCharitySignatoryName(),
                'status' => DonationReceiptStatus::ISSUED->name,
            ]);

            $this->logger->info('Donation receipt issued', [
                'orderId' => $order->getId(),
                'receiptNumber' => $receipt->getReceiptNumber(),
                'eligibleAmount' => $breakdown->eligibleAmount,
            ]);

            return $receipt;
        });
    }

    /**
     * Serie sequentielle par organisme ET par annee, jamais reutilisee. On
     * repart de receipt_number et non d'un compteur de lignes: un recu remplace
     * reste en base, donc compter les lignes finirait par produire un doublon.
     */
    private function nextReceiptNumber(
        int                             $organizerId,
        int                             $year,
        ?OrganizerSettingDomainObject   $settings
    ): string
    {
        $prefix = trim((string)$settings?->getCharityReceiptPrefix());
        $prefix = $prefix !== '' ? $prefix : ($year . '-');

        $latest = $this->donationReceiptRepository->findLatestForOrganizerYear($organizerId, $year);

        if ($latest === null) {
            return $prefix . '1';
        }

        $latestSequence = (int)preg_replace('/\D+/', '', substr($latest->getReceiptNumber(), strlen($prefix)) ?: '0');

        return $prefix . ($latestSequence + 1);
    }

    /**
     * L'ARC exige l'adresse complete du donateur. Elle n'est collectee que si
     * require_billing_address est actif sur l'evenement: on renvoie null sinon,
     * et le PDF affiche un avertissement plutot qu'une adresse inventee.
     */
    private function formatDonorAddress(OrderDomainObject $order): ?string
    {
        $address = $order->getAddress();

        if (!is_array($address) || $address === []) {
            return null;
        }

        $lines = array_filter([
            $address['address_line_1'] ?? null,
            $address['address_line_2'] ?? null,
            trim(implode(', ', array_filter([
                $address['city'] ?? null,
                $address['state_or_region'] ?? null,
                $address['zip_or_postal_code'] ?? null,
            ]))),
            $address['country'] ?? null,
        ], static fn($line) => is_string($line) && trim($line) !== '');

        return $lines === [] ? null : implode("\n", $lines);
    }
}
