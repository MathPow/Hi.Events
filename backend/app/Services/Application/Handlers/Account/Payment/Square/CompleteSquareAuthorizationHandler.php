<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Account\Payment\Square;

use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Services\Domain\Payment\Square\DTO\SquareConnectionDTO;
use HiEvents\Services\Domain\Payment\Square\SquareConnectionService;
use HiEvents\Services\Infrastructure\Encryption\EncryptedPayloadService;
use HiEvents\Services\Infrastructure\Encryption\Exception\DecryptionFailedException;
use HiEvents\Services\Infrastructure\Encryption\Exception\EncryptedPayloadExpiredException;

class CompleteSquareAuthorizationHandler
{
    public function __construct(
        private readonly SquareConnectionService $connectionService,
        private readonly EncryptedPayloadService $encryptedPayloadService,
    )
    {
    }

    /**
     * @throws SquareOAuthException
     */
    public function handle(int $accountId, string $code, string $state): SquareConnectionDTO
    {
        try {
            $payload = $this->encryptedPayloadService->decryptPayload($state);
        } catch (EncryptedPayloadExpiredException) {
            throw new SquareOAuthException(
                __('This Square authorization has expired. Please start again.')
            );
        } catch (DecryptionFailedException) {
            throw new SquareOAuthException(
                __('This Square authorization could not be verified. Please start again.')
            );
        }

        // Un code valide renvoye avec le state d'un autre compte brancherait le
        // marchand sur le mauvais compte.
        if ((int)($payload['account_id'] ?? 0) !== $accountId) {
            throw new SquareOAuthException(
                __('This Square authorization was issued for a different account.')
            );
        }

        return $this->connectionService->connect($accountId, $code);
    }
}
