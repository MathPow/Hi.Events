<?php

namespace HiEvents\Http\Actions\ApiTokens;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;

class DeleteApiTokenAction extends BaseAction
{
    public function __invoke(int $tokenId): JsonResponse
    {
        $this->minimumAllowedRole(Role::ADMIN);

        // La clause sur l'ability borne la revocation au compte courant: sans
        // elle, un id devine suffirait a revoquer le jeton d'un autre compte.
        $deleted = DB::table('personal_access_tokens')
            ->where('id', $tokenId)
            ->where('tokenable_type', $this->userMorphAlias())
            ->whereJsonContains('abilities', 'account:' . User::getCurrentAccountId())
            ->delete();

        if ($deleted === 0) {
            return new JsonResponse(['message' => __('Token not found.')], ResponseCodes::HTTP_NOT_FOUND);
        }

        return new JsonResponse(null, ResponseCodes::HTTP_NO_CONTENT);
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
