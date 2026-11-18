<?php

namespace HiEvents\Services\Application\Handlers\TicketLookup;

use Carbon\Carbon;
use HiEvents\Exceptions\InvalidTicketLookupTokenException;
use HiEvents\Repository\Interfaces\TicketLookupTokenRepositoryInterface;

/**
 * Opens « Mes billets » from the emailed link: the link gives its email, then only works for a few
 * more minutes (a second click, a mail scanner opening it first), so a copied or forwarded link
 * goes dead. The device is remembered by its cookie instead.
 */
class OpenTicketLookupSessionHandler
{
    private const LINK_GRACE_MINUTES = 15;

    public function __construct(
        private readonly TicketLookupTokenRepositoryInterface $ticketLookupTokenRepository,
    ) {
    }

    /**
     * @throws InvalidTicketLookupTokenException
     */
    public function handle(string $token): string
    {
        $tokenRecord = $this->ticketLookupTokenRepository->findFirstWhere(['token' => $token]);

        if (!$tokenRecord) {
            throw new InvalidTicketLookupTokenException(__('Invalid or expired link. Please request a new one.'));
        }

        $expiresAt = new Carbon($tokenRecord->getExpiresAt());

        if ($expiresAt->isPast()) {
            throw new InvalidTicketLookupTokenException(__('This link has expired. Please request a new one.'));
        }

        $graceEnd = Carbon::now()->addMinutes(self::LINK_GRACE_MINUTES);

        if ($expiresAt->greaterThan($graceEnd)) {
            $this->ticketLookupTokenRepository->updateWhere(
                attributes: ['expires_at' => $graceEnd->toDateTimeString()],
                where: ['token' => $token],
            );
        }

        return $tokenRecord->getEmail();
    }
}
