<?php

namespace HiEvents\Http\Actions\Users\Push;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Domain\Notification\WebPushService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * L'appareil de l'utilisateur connecte accepte les notifications (PushSubscription du navigateur).
 */
class CreatePushSubscriptionAction extends BaseAction
{
    public function __construct(
        private readonly WebPushService $webPushService,
    )
    {
    }

    public function __invoke(Request $request): Response
    {
        $data = $this->validate($request, [
            'endpoint' => 'required|url|starts_with:https://|max:2000',
            'keys.p256dh' => 'required|string|max:255',
            'keys.auth' => 'required|string|max:255',
            'content_encoding' => 'nullable|string|in:aes128gcm,aesgcm',
        ]);

        $this->webPushService->subscribe(
            userId: $this->getAuthenticatedUser()->getId(),
            endpoint: $data['endpoint'],
            publicKey: $data['keys']['p256dh'],
            authToken: $data['keys']['auth'],
            contentEncoding: $data['content_encoding'] ?? 'aes128gcm',
            userAgent: $request->userAgent(),
        );

        return $this->noContentResponse();
    }
}
