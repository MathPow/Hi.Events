<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Account\Payment\Square;

use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Services\Domain\Payment\Square\SquareOAuthService;
use HiEvents\Services\Infrastructure\Encryption\EncryptedPayloadService;
use Illuminate\Support\Carbon;

class CreateSquareAuthorizationUrlHandler
{
    /**
     * L'aller-retour chez Square ne devrait prendre qu'une minute; une heure
     * laisse de la marge sans faire d'un lien intercepte une porte ouverte
     * durable.
     */
    private const STATE_LIFETIME_MINUTES = 60;

    public function __construct(
        private readonly SquareOAuthService      $oAuthService,
        private readonly EncryptedPayloadService $encryptedPayloadService,
    )
    {
    }

    /**
     * @throws SquareOAuthException
     */
    public function handle(int $accountId, int $userId): string
    {
        // Le state est chiffre et porte le compte: au retour, il prouve que
        // l'autorisation repond bien a une demande partie d'ici, et pour ce
        // compte-la.
        $state = $this->encryptedPayloadService->encryptPayload(
            payload: [
                'account_id' => $accountId,
                'user_id' => $userId,
            ],
            expiry: Carbon::now()->addMinutes(self::STATE_LIFETIME_MINUTES),
        );

        return $this->oAuthService->buildAuthorizeUrl($state);
    }
}
