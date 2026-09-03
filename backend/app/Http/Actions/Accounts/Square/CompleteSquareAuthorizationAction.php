<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Accounts\Square;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Account\Square\CompleteSquareAuthorizationRequest;
use HiEvents\Resources\Account\Square\SquareConnectionResource;
use HiEvents\Services\Application\Handlers\Account\Payment\Square\CompleteSquareAuthorizationHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class CompleteSquareAuthorizationAction extends BaseAction
{
    public function __construct(
        private readonly CompleteSquareAuthorizationHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(CompleteSquareAuthorizationRequest $request, int $accountId): JsonResponse
    {
        $this->isActionAuthorized($accountId, AccountDomainObject::class, Role::ADMIN);

        try {
            $connection = $this->handler->handle(
                accountId: $accountId,
                code: $request->validated('code'),
                state: $request->validated('state'),
            );
        } catch (SquareOAuthException $exception) {
            throw ValidationException::withMessages([
                'code' => $exception->getMessage(),
            ]);
        }

        return $this->jsonResponse(
            data: new SquareConnectionResource($connection),
            wrapInData: true,
        );
    }
}
