<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Account;

use HiEvents\Exceptions\EmailSendingLimitExceededException;
use HiEvents\Repository\Interfaces\AccountMessagingTierRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use Illuminate\Cache\RateLimiter;
use Illuminate\Config\Repository;

/**
 * Plafond quotidien des courriels qu'un organisateur declenche a la main:
 * billet ajoute depuis le tableau de bord, renvoi d'un billet ou d'une
 * confirmation, invitation d'un membre d'equipe, vente a la porte.
 *
 * Ces courriels partent de l'adresse de la plateforme vers des adresses que
 * l'organisateur saisit lui-meme. Sans plafond, un compte cree pour l'occasion
 * s'en servirait pour arroser n'importe qui, et c'est la reputation du domaine
 * qui en paierait le prix. Seul le palier Untrusted est plafonne: un superadmin
 * leve la limite en changeant le palier du compte.
 */
class OrganizerEmailQuotaService
{
    private const UNTRUSTED_TIER_NAME = 'Untrusted';

    private const WINDOW_SECONDS = 86400;

    public function __construct(
        private readonly AccountRepositoryInterface              $accountRepository,
        private readonly EventRepositoryInterface                $eventRepository,
        private readonly AccountMessagingTierRepositoryInterface $messagingTierRepository,
        private readonly RateLimiter                             $rateLimiter,
        private readonly Repository                              $config,
    )
    {
    }

    /**
     * @throws EmailSendingLimitExceededException
     */
    public function consumeForAccount(int $accountId): void
    {
        if (!$this->tryConsumeForAccount($accountId)) {
            throw new EmailSendingLimitExceededException(
                __('You have reached the daily limit of emails you can send manually. Contact us to raise it.')
            );
        }
    }

    /**
     * @throws EmailSendingLimitExceededException
     */
    public function consumeForEvent(int $eventId): void
    {
        $this->consumeForAccount($this->getEventAccountId($eventId));
    }

    public function tryConsumeForEvent(int $eventId): bool
    {
        return $this->tryConsumeForAccount($this->getEventAccountId($eventId));
    }

    public function tryConsumeForAccount(int $accountId): bool
    {
        if (!$this->isLimited($accountId)) {
            return true;
        }

        $key = 'organizer-emails:' . $accountId;
        $limit = (int)$this->config->get('app.untrusted_account_daily_email_limit');

        if ($this->rateLimiter->tooManyAttempts($key, $limit)) {
            return false;
        }

        $this->rateLimiter->hit($key, self::WINDOW_SECONDS);

        return true;
    }

    private function isLimited(int $accountId): bool
    {
        $tierId = $this->accountRepository->findById($accountId)->getAccountMessagingTierId();

        if ($tierId === null) {
            return true;
        }

        $tier = $this->messagingTierRepository->findFirst($tierId);

        return $tier === null || $tier->getName() === self::UNTRUSTED_TIER_NAME;
    }

    private function getEventAccountId(int $eventId): int
    {
        return $this->eventRepository->findById($eventId)->getAccountId();
    }
}
