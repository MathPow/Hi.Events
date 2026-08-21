<?php

namespace HiEvents\Http\Middleware;

use Closure;
use HiEvents\DomainObjects\Enums\Role;
use HiEvents\DomainObjects\Status\UserStatus;
use HiEvents\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

/**
 * Permet a une application tierce d'appeler l'API avec un jeton long terme
 * plutot qu'avec le couple courriel + mot de passe.
 *
 * Plutot que d'ajouter un second garde en parallele du JWT, on ECHANGE le jeton
 * contre un JWT interne et on reecrit l'en-tete Authorization. Tout l'aval --
 * auth:api, SetAccountContext, AuthUserService, les controles de role -- voit
 * exactement ce qu'il verrait pour un utilisateur connecte normalement. Aucune
 * route existante n'a besoin d'etre touchee, et il n'existe pas de second
 * chemin d'autorisation a maintenir en phase avec le premier.
 *
 * Discriminant: un jeton Sanctum s'ecrit « <id>|<secret> ». Un JWT est du
 * base64url separe par des points et ne contient jamais de barre verticale.
 */
class ExchangeApiTokenForJwt
{
    public function handle($request, Closure $next)
    {
        $bearer = $request->bearerToken();

        if (!$bearer || !str_contains($bearer, '|')) {
            return $next($request);
        }

        $token = PersonalAccessToken::findToken($bearer);

        if (!$token) {
            return $this->deny(__('Invalid API token.'));
        }

        if ($token->expires_at !== null && $token->expires_at->isPast()) {
            return $this->deny(__('This API token has expired.'));
        }

        /** @var User|null $user */
        $user = $token->tokenable;

        if (!$user instanceof User) {
            return $this->deny(__('Invalid API token.'));
        }

        $accountId = $this->accountIdFromAbilities($token->abilities ?? []);

        if ($accountId === null) {
            return $this->deny(__('This API token is not bound to an account.'));
        }

        $accountUser = DB::table('account_users')
            ->where('user_id', $user->id)
            ->where('account_id', $accountId)
            ->first();

        // Le jeton ne doit pas survivre au retrait de son porteur du compte.
        if (!$accountUser || $accountUser->status !== UserStatus::ACTIVE->name) {
            return $this->deny(__('This API token is no longer active.'));
        }

        $jwt = JWTAuth::claims([
            'account_id' => $accountId,
            'role' => $accountUser->role ?? Role::ORGANIZER->value,
            'is_api_token' => true,
        ])->fromUser($user);

        $request->headers->set('Authorization', 'Bearer ' . $jwt);
        $request->attributes->set('is_api_token_request', true);

        // Ecriture directe: passer par le modele declencherait les timestamps et
        // ferait mentir updated_at sur chaque appel.
        DB::table('personal_access_tokens')->where('id', $token->id)->update(['last_used_at' => now()]);

        return $next($request);
    }

    private function accountIdFromAbilities(array $abilities): ?int
    {
        foreach ($abilities as $ability) {
            if (is_string($ability) && str_starts_with($ability, 'account:')) {
                return (int)substr($ability, strlen('account:'));
            }
        }

        return null;
    }

    private function deny(string $message): JsonResponse
    {
        return new JsonResponse(['message' => $message], 401);
    }
}
