<?php

namespace HiEvents\Http\Actions\ApiTokens;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;

class GetApiTokensAction extends BaseAction
{
    public function __invoke(): JsonResponse
    {
        $this->minimumAllowedRole(Role::ADMIN);

        $tokens = DB::table('personal_access_tokens')
            ->where('tokenable_type', $this->userMorphAlias())
            ->whereJsonContains('abilities', 'account:' . User::getCurrentAccountId())
            ->orderBy('id', 'desc')
            ->get();

        return new JsonResponse([
            // Le jeton en clair n'existe nulle part en base: on n'expose que les
            // metadonnees, jamais de quoi rejouer un appel.
            'data' => $tokens->map(fn($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'last_used_at' => $token->last_used_at,
                'expires_at' => $token->expires_at,
                'created_at' => $token->created_at,
            ])->values(),
        ]);
    }

    /**
     * tokenable_type stocke l'ALIAS de la morph map, pas le nom de classe du
     * modele. Comparer a User::class ne remonterait jamais rien.
     */
    private function userMorphAlias(): string
    {
        $alias = array_search(User::class, Relation::morphMap(), true);

        return $alias === false ? User::class : (string)$alias;
    }
}
