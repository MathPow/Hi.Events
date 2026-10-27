<?php

declare(strict_types=1);

namespace HiEvents\Http\Request\Assistant;

use HiEvents\Http\Request\BaseRequest;

/**
 * Toute la conversation, au format de l'API d'Anthropic (resultats d'outils
 * et reflexions signees compris) : le navigateur la garde et la renvoie a
 * chaque tour.
 */
class AssistantTurnRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'messages' => 'required|array|min:1|max:600',
            'messages.*.role' => 'required|in:user,assistant',
            'messages.*.content' => 'required',
        ];
    }
}
