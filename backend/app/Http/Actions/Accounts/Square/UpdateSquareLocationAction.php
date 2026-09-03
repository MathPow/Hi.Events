<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Accounts\Square;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Account\Square\UpdateSquareLocationRequest;
use HiEvents\Resources\Account\Square\SquareConnectionResource;
use HiEvents\Services\Application\Handlers\Account\Payment\Square\UpdateSquareLocationHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class UpdateSquareLocationAction extends BaseAction
{
    public function __construct(
        private readonly UpdateSquareLocationHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(UpdateSquareLocationRequest $request, int $accountId): JsonResponse
    {
        $this->isActionAuthorized($accountId, AccountDomainObject::class, Role::ADMIN);

        try {
            $connection = $this->handler->handle($accountId, $request->validated('location_id'));
        } catch (SquareNotConnectedException|SquareOAuthException $exception) {
            throw ValidationException::withMessages([
                'location_id' => $exception->getMessage(),
            ]);
        }

        return $this->jsonResponse(
            data: new SquareConnectionResource($connection),
            wrapInData: true,
        );
    }
}
