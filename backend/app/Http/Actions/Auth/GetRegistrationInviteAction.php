<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Auth;

use HiEvents\Exceptions\InvalidRegistrationInviteException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Services\Domain\Account\AccountRegistrationInviteService;
use Illuminate\Http\JsonResponse;

/**
 * Permet a la page d'inscription de dire tout de suite si le lien tient encore,
 * et de pre-remplir l'email quand l'invitation est nominative, plutot que de
 * laisser la personne remplir le formulaire pour rien.
 */
class GetRegistrationInviteAction extends BaseAction
{
    public function __construct(
        private readonly AccountRegistrationInviteService $registrationInviteService,
    )
    {
    }

    public function __invoke(string $registrationToken): JsonResponse
    {
        try {
            $invite = $this->registrationInviteService->findUsableByToken($registrationToken);
        } catch (InvalidRegistrationInviteException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: ResponseCodes::HTTP_GONE,
            );
        }

        return $this->jsonResponse(
            data: [
                'email' => $invite->getEmail(),
                'expires_at' => $invite->getExpiresAt(),
            ],
            wrapInData: true,
        );
    }
}
