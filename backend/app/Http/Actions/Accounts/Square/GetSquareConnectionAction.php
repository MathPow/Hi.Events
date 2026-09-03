<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Accounts\Square;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Account\Square\SquareConnectionResource;
use HiEvents\Services\Application\Handlers\Account\Payment\Square\GetSquareConnectionHandler;
use Illuminate\Http\JsonResponse;

class GetSquareConnectionAction extends BaseAction
{
    public function __construct(
        private readonly GetSquareConnectionHandler $handler,
    )
    {
    }

    public function __invoke(int $accountId): JsonResponse
    {
        $this->isActionAuthorized($accountId, AccountDomainObject::class, Role::ADMIN);

        try {
            $connection = $this->handler->handle($accountId);
        } catch (SquareOAuthException $exception) {
            return $this->errorResponse($exception->getMessage());
        }

        return $this->jsonResponse(
            data: new SquareConnectionResource($connection),
            wrapInData: true,
        );
    }
}
