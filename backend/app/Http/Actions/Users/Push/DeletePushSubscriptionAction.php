<?php

namespace HiEvents\Http\Actions\Users\Push;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Domain\Notification\WebPushService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class DeletePushSubscriptionAction extends BaseAction
{
    public function __construct(
        private readonly WebPushService $webPushService,
    )
    {
    }

    public function __invoke(Request $request): Response
    {
        $data = $this->validate($request, ['endpoint' => 'required|string|max:2000']);

        $this->webPushService->unsubscribe($this->getAuthenticatedUser()->getId(), $data['endpoint']);

        return $this->noContentResponse();
    }
}
