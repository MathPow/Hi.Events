<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Accounts\Square;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Account\Payment\Square\CreateSquareAuthorizationUrlHandler;
use Illuminate\Http\JsonResponse;

class CreateSquareAuthorizationUrlAction extends BaseAction
{
    public function __construct(
        private readonly CreateSquareAuthorizationUrlHandler $handler,
    )
    {
    }

    public function __invoke(int $accountId): JsonResponse
    {
        $this->isActionAuthorized($accountId, AccountDomainObject::class, Role::ADMIN);

        try {
            $authorizeUrl = $this->handler->handle($accountId, $this->getAuthenticatedUser()->getId());
        } catch (SquareOAuthException $exception) {
            return $this->errorResponse($exception->getMessage());
        }

        return $this->jsonResponse(
            data: ['authorize_url' => $authorizeUrl],
            wrapInData: true,
        );
    }
}
