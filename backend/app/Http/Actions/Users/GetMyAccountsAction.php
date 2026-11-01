<?php

namespace HiEvents\Http\Actions\Users;

use HiEvents\Http\Actions\Auth\BaseAuthAction;
use HiEvents\Services\Application\Handlers\Auth\GetUserAccountsHandler;
use Illuminate\Http\JsonResponse;

/**
 * The accounts the signed-in person can open (the organizer switcher lists the others).
 */
class GetMyAccountsAction extends BaseAuthAction
{
    public function __construct(
        private readonly GetUserAccountsHandler $handler,
    )
    {
    }

    public function __invoke(): JsonResponse
    {
        return $this->jsonResponse([
            'data' => $this->handler->handle(
                $this->getAuthenticatedUser()->getId(),
                $this->getAuthenticatedAccountId(),
            ),
        ]);
    }
}
