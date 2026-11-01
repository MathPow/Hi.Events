<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Auth;

use HiEvents\Exceptions\UnauthorizedException;
use HiEvents\Services\Application\Handlers\Auth\DTO\SwitchAccountDTO;
use HiEvents\Services\Application\Handlers\Auth\SwitchAccountHandler;
use HiEvents\Services\Application\Handlers\Auth\GetUserAccountsHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Opens another account the person belongs to, without signing in again.
 */
class SwitchAccountAction extends BaseAuthAction
{
    public function __construct(
        private readonly SwitchAccountHandler   $switchAccountHandler,
        private readonly GetUserAccountsHandler $getUserAccountsHandler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request): JsonResponse
    {
        $this->validate($request, [
            'account_id' => ['required', 'integer'],
        ]);

        $userId = $this->getAuthenticatedUser()->getId();
        $accountId = (int)$request->input('account_id');

        try {
            $token = $this->switchAccountHandler->handle(new SwitchAccountDTO(
                userId: $userId,
                accountId: $accountId,
                isImpersonating: (bool)auth()->payload()->get('is_impersonating', false),
            ));
        } catch (UnauthorizedException $exception) {
            // Not a 401/403: the app would take it for an expired session and sign the person out.
            throw ValidationException::withMessages(['account_id' => $exception->getMessage()]);
        }

        return $this->addTokenToResponse(
            response: $this->jsonResponse([
                'token' => $token,
                'accounts' => $this->getUserAccountsHandler->handle($userId, $accountId),
            ]),
            token: $token,
        );
    }
}
