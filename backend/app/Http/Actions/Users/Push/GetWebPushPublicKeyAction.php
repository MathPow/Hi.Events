<?php

namespace HiEvents\Http\Actions\Users\Push;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Domain\Notification\WebPushService;
use Illuminate\Http\JsonResponse;

/**
 * La cle publique VAPID du serveur, que le navigateur demande pour abonner l'appareil.
 */
class GetWebPushPublicKeyAction extends BaseAction
{
    public function __construct(
        private readonly WebPushService $webPushService,
    )
    {
    }

    public function __invoke(): JsonResponse
    {
        $this->getAuthenticatedUser();

        return $this->jsonResponse(['public_key' => $this->webPushService->publicKey()]);
    }
}
