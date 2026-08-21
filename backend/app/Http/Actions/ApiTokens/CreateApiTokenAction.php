<?php

namespace HiEvents\Http\Actions\ApiTokens;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CreateApiTokenAction extends BaseAction
{
    public function __invoke(Request $request): JsonResponse
    {
        $this->minimumAllowedRole(Role::ADMIN);

        // Un jeton ne doit pas pouvoir en fabriquer d'autres: sinon un jeton
        // divulgue se renouvelle tout seul et le revoquer ne sert plus a rien.
        if ($request->attributes->get('is_api_token_request')) {
            return new JsonResponse(
                ['message' => __('API tokens cannot create other API tokens. Sign in to manage tokens.')],
                ResponseCodes::HTTP_FORBIDDEN,
            );
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        /** @var User $user */
        $user = User::findOrFail($this->getAuthenticatedUser()->getId());

        $token = $user->createToken(
            name: $validated['name'],
            abilities: ['account:' . User::getCurrentAccountId()],
            expiresAt: isset($validated['expires_at']) ? now()->parse($validated['expires_at']) : null,
        );

        return new JsonResponse([
            'data' => [
                'id' => $token->accessToken->id,
                'name' => $token->accessToken->name,
                'expires_at' => $token->accessToken->expires_at,
                // Montre UNE seule fois. Seul le hachage est conserve en base.
                'token' => $token->plainTextToken,
            ],
        ], ResponseCodes::HTTP_CREATED);
    }
}
