<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Orders\Payment\Square;

use HiEvents\DomainObjects\Generated\AccountSquareCredentialDomainObjectAbstract;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountSquareCredentialRepositoryInterface;
use HiEvents\Services\Infrastructure\Square\SquareConfigurationService;
use Illuminate\Http\JsonResponse;

/**
 * Ce que le navigateur doit connaitre pour initialiser le SDK Web Payments:
 * l'identifiant d'application, le point de vente qui encaisse et
 * l'environnement, le SDK etant servi depuis un domaine different en bac a
 * sable et en production.
 */
class GetSquareCheckoutConfigActionPublic extends BaseAction
{
    public function __construct(
        private readonly AccountRepositoryInterface                 $accountRepository,
        private readonly AccountSquareCredentialRepositoryInterface $credentialRepository,
        private readonly SquareConfigurationService                 $configurationService,
    )
    {
    }

    public function __invoke(int $eventId): JsonResponse
    {
        $account = $this->accountRepository->findByEventId($eventId);
        $environment = $this->configurationService->getEnvironment();

        $credential = $account === null ? null : $this->credentialRepository->findFirstWhere([
            AccountSquareCredentialDomainObjectAbstract::ACCOUNT_ID => $account->getId(),
            AccountSquareCredentialDomainObjectAbstract::ENVIRONMENT => $environment->value,
        ]);

        $locationId = $credential?->getLocationId() ?? $this->configurationService->getFallbackLocationId();
        $applicationId = $this->configurationService->getApplicationId();

        if ($applicationId === null || $locationId === null) {
            return $this->errorResponse(
                message: __('Square is not available for this event.'),
                statusCode: ResponseCodes::HTTP_NOT_FOUND,
            );
        }

        return $this->jsonResponse([
            'application_id' => $applicationId,
            'location_id' => $locationId,
            'environment' => $environment->value,
            'sdk_url' => $environment->webPaymentsSdkUrl(),
        ]);
    }
}
