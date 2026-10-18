<?php

namespace HiEvents\Http\Middleware;

use Closure;
use HiEvents\Http\ResponseCodes;
use HiEvents\Services\Domain\Account\AccountSuspensionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Coupe l'acces d'un compte des sa suspension, y compris pour les jetons deja
 * emis. Un superadmin qui se fait passer pour le compte garde l'acces, pour
 * pouvoir constater ce qu'il a suspendu.
 */
class RejectSuspendedAccount
{
    public function __construct(
        private readonly AccountSuspensionService $accountSuspensionService,
    )
    {
    }

    public function handle(Request $request, Closure $next)
    {
        if (!Auth::check() || $request->routeIs('auth.logout')) {
            return $next($request);
        }

        $payload = Auth::payload();
        $accountId = $payload->get('account_id');

        if ($accountId === null || $payload->get('is_impersonating', false)) {
            return $next($request);
        }

        if ($this->accountSuspensionService->isSuspended((int)$accountId)) {
            return response()->json([
                'message' => __('This account has been suspended. Contact support for more information.'),
            ], ResponseCodes::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
