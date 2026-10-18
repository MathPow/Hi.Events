<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Admin\Accounts;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Account\AdminAccountDetailResource;
use HiEvents\Services\Application\Handlers\Admin\DTO\UpdateAccountTrustSettingsDTO;
use HiEvents\Services\Application\Handlers\Admin\GetAccountHandler;
use HiEvents\Services\Application\Handlers\Admin\UpdateAccountTrustSettingsHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class UpdateAccountTrustSettingsAction extends BaseAction
{
    public function __construct(
        private readonly UpdateAccountTrustSettingsHandler $handler,
        private readonly GetAccountHandler                 $getAccountHandler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request, int $accountId): JsonResponse
    {
        $this->minimumAllowedRole(Role::SUPERADMIN);

        $validated = $request->validate([
            'platform_payments_allowed' => 'sometimes|boolean',
            'donation_receipts_allowed' => 'sometimes|boolean',
            'suspended' => 'sometimes|boolean',
        ]);

        if (($validated['suspended'] ?? false) && $accountId === $this->getAuthenticatedAccountId()) {
            throw ValidationException::withMessages([
                'suspended' => __('You cannot suspend the account you are logged into.'),
            ]);
        }

        $this->handler->handle(new UpdateAccountTrustSettingsDTO(
            accountId: $accountId,
            platformPaymentsAllowed: isset($validated['platform_payments_allowed']) ? (bool)$validated['platform_payments_allowed'] : null,
            donationReceiptsAllowed: isset($validated['donation_receipts_allowed']) ? (bool)$validated['donation_receipts_allowed'] : null,
            suspended: isset($validated['suspended']) ? (bool)$validated['suspended'] : null,
        ));

        return $this->jsonResponse(
            new AdminAccountDetailResource($this->getAccountHandler->handle($accountId)),
            wrapInData: true,
        );
    }
}
