<?php

namespace HiEvents\Services\Domain\Mcp;

use HiEvents\Services\Domain\Assistant\AssistantInstructions;
use HiEvents\Services\Domain\Assistant\AssistantRoutes;

/**
 * Ce que le serveur MCP dit de la billetterie aux agents qui s'y branchent : les mêmes
 * connaissances que l'assistant intégré, sans ce qui tient à sa fenêtre (questions en
 * boutons, ouverture de pages).
 */
class McpInstructions
{
    private const INTRO = <<<'TXT'
Serveur MCP de la Billetterie Dehors (billets.dehorsqc.com), la billetterie de DEHORS pour les courses, les sorties et les compétitions locales au Québec, sur Hi.Events adapté par DEHORS. Il passe par l'API de la billetterie avec le jeton d'API du compte, donc avec ses droits.

## Outils
- `lire_billetterie` : un GET sur l'API. Lis avant d'affirmer ; commence par GET /events ou GET /organizers pour trouver les identifiants.
- `modifier_billetterie` : un POST, PUT, PATCH ou DELETE. Lis d'abord l'état actuel. Un PUT remplace la ressource : renvoie tous ses champs. PATCH ne prend que les champs à changer. Une erreur 422 donne les champs refusés.
- `reference_api` : les routes permises et les champs de leur corps (règles de validation Laravel). Filtre par un bout de chemin, ex. « /products » ou « promo-codes ».
- Les chemins sont relatifs à l'API : /events/12, pas /api/events/12. La connexion, les jetons, la super-administration, les utilisateurs du compte et Stripe sont refusés (403).
- Seulement sur demande explicite : rembourser, annuler une commande, la marquer payée, envoyer un message aux participants (de vrais courriels), renvoyer des billets, supprimer, mettre en ligne ou archiver un événement, toucher aux webhooks.
- Les acheteurs et participants sont de vraies personnes : n'en sors que ce que la demande exige.
- Espace organisateur, pour donner des liens : https://billets.dehorsqc.com/manage/event/{id}/{page} (dashboard, products, orders, attendees, questions, promo-codes, messages, check-in, settings…) et /manage/organizer/{id}/{page}. Page publique : https://billets.dehorsqc.com/event/{id}/{slug}.

TXT;

    public function instructions(): string
    {
        return self::INTRO . AssistantInstructions::BILLETTERIE;
    }

    /**
     * La référence de l'API, entière ou réduite aux routes dont la ligne contient le filtre.
     */
    public function reference(?string $filter = null): string
    {
        $reference = (string)@file_get_contents(base_path(AssistantRoutes::REFERENCE_PATH));
        $filter = trim((string)$filter);

        if ($filter === '') {
            return $reference;
        }

        $kept = [];
        $keep = false;

        foreach (preg_split('/\R/', $reference) as $line) {
            if (preg_match('/^(GET|POST|PUT|PATCH|DELETE) /', $line)) {
                $keep = stripos($line, $filter) !== false;
            }

            if ($keep) {
                $kept[] = $line;
            }
        }

        return implode("\n", $kept);
    }
}
