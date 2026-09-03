<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Accounts\Square;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Services\Application\Handlers\Account\Payment\Square\DisconnectSquareHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class DisconnectSquareAction extends BaseAction
{
    public function __construct(
        private readonly DisconnectSquareHandler $handler,
    )
    {
    }

    public function __invoke(int $accountId): Response|JsonResponse
    {
        $this->isActionAuthorized($accountId, AccountDomainObject::class, Role::ADMIN);

        try {
            $this->handler->handle($accountId);
        } catch (SquareNotConnectedException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: ResponseCodes::HTTP_NOT_FOUND,
            );
        }

        return $this->deletedResponse();
    }
}
