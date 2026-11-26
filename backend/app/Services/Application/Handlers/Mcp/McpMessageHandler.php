<?php

namespace HiEvents\Services\Application\Handlers\Mcp;

use HiEvents\Services\Domain\Assistant\AssistantRoutes;
use HiEvents\Services\Domain\Mcp\McpApiProxy;
use HiEvents\Services\Domain\Mcp\McpInstructions;

/**
 * Un message JSON-RPC du protocole MCP (transport HTTP, sans session ni flux) : la
 * poignée de main, la liste des outils et leurs appels. Les outils lisent et modifient
 * la billetterie par son API, avec les droits du jeton qui appelle.
 */
class McpMessageHandler
{
    public const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

    private const MAX_OUTPUT = 60000;

    private const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    public function __construct(
        private readonly McpApiProxy     $proxy,
        private readonly McpInstructions $instructions,
    )
    {
    }

    /**
     * @return array<string, mixed>|null La réponse, ou null pour une notification.
     */
    public function handle(mixed $message, string $authorization, ?string $clientIp): ?array
    {
        if (!is_array($message) || ($message['jsonrpc'] ?? null) !== '2.0' || !is_string($message['method'] ?? null)) {
            return $this->error(null, -32600, 'Invalid Request');
        }

        if (!array_key_exists('id', $message)) {
            return null;
        }

        $id = $message['id'];
        $params = is_array($message['params'] ?? null) ? $message['params'] : [];

        return match ($message['method']) {
            'initialize' => $this->result($id, $this->initialize($params)),
            'ping' => $this->result($id, new \stdClass()),
            'tools/list' => $this->result($id, ['tools' => $this->tools()]),
            'tools/call' => $this->callTool($id, $params, $authorization, $clientIp),
            default => $this->error($id, -32601, 'Method not found'),
        };
    }

    private function initialize(array $params): array
    {
        $requested = $params['protocolVersion'] ?? null;

        return [
            'protocolVersion' => in_array($requested, self::PROTOCOL_VERSIONS, true) ? $requested : self::PROTOCOL_VERSIONS[0],
            'capabilities' => ['tools' => ['listChanged' => false]],
            'serverInfo' => ['name' => 'billetterie-dehors', 'title' => 'Billetterie Dehors', 'version' => '1.0.0'],
            'instructions' => $this->instructions->instructions(),
        ];
    }

    private function tools(): array
    {
        return [
            [
                'name' => 'lire_billetterie',
                'title' => 'Lire la billetterie',
                'description' => "Lit l'API de la billetterie (GET) : organisateurs, événements, billets, commandes, participants, "
                    . "codes promo, questions, messages, rapports, réglages. Les listes se paginent (page, per_page), "
                    . "se cherchent (query) et se filtrent (filter_fields[status][eq]=COMPLETED).",
                'inputSchema' => [
                    'type' => 'object',
                    'properties' => [
                        'chemin' => [
                            'type' => 'string',
                            'description' => 'Chemin et requête, commençant par /. Ex. : /events/12/orders?per_page=50&filter_fields[status][eq]=COMPLETED',
                        ],
                    ],
                    'required' => ['chemin'],
                ],
                'annotations' => ['readOnlyHint' => true, 'openWorldHint' => false],
            ],
            [
                'name' => 'modifier_billetterie',
                'title' => 'Modifier la billetterie',
                'description' => "Modifie la billetterie (POST, PUT, PATCH ou DELETE sur son API). Lis d'abord l'état actuel ; "
                    . "un PUT remplace la ressource entière. Les champs de chaque route sont dans `reference_api`. "
                    . "Certaines routes envoient de vrais courriels (messages, renvoi de billets) ou touchent à l'argent "
                    . "(remboursements) : seulement sur demande explicite.",
                'inputSchema' => [
                    'type' => 'object',
                    'properties' => [
                        'methode' => ['type' => 'string', 'enum' => self::WRITE_METHODS],
                        'chemin' => ['type' => 'string', 'description' => 'Commence par /. Ex. : /events/12/products/34'],
                        'corps' => ['type' => 'object', 'description' => 'Le corps JSON. Absent pour un DELETE.'],
                    ],
                    'required' => ['methode', 'chemin'],
                ],
                'annotations' => ['readOnlyHint' => false, 'destructiveHint' => true, 'idempotentHint' => false, 'openWorldHint' => true],
            ],
            [
                'name' => 'reference_api',
                'title' => "Référence de l'API",
                'description' => "Les routes permises de l'API de la billetterie, avec les champs de leur corps et leurs règles "
                    . "de validation. Sans filtre, la référence entière (longue).",
                'inputSchema' => [
                    'type' => 'object',
                    'properties' => [
                        'filtre' => [
                            'type' => 'string',
                            'description' => 'Un bout de chemin pour ne garder que ces routes. Ex. : /products, promo-codes, /orders',
                        ],
                    ],
                ],
                'annotations' => ['readOnlyHint' => true, 'openWorldHint' => false],
            ],
        ];
    }

    private function callTool(mixed $id, array $params, string $authorization, ?string $clientIp): array
    {
        $arguments = is_array($params['arguments'] ?? null) ? $params['arguments'] : [];

        return match ($params['name'] ?? null) {
            'lire_billetterie' => $this->result($id, $this->request('GET', $arguments['chemin'] ?? null, null, $authorization, $clientIp)),
            'modifier_billetterie' => $this->result($id, $this->modify($arguments, $authorization, $clientIp)),
            'reference_api' => $this->result($id, $this->text($this->instructions->reference($arguments['filtre'] ?? null) ?: 'Aucune route ne correspond à ce filtre.')),
            default => $this->error($id, -32602, 'Unknown tool'),
        };
    }

    private function modify(array $arguments, string $authorization, ?string $clientIp): array
    {
        $method = strtoupper((string)($arguments['methode'] ?? ''));

        if (!in_array($method, self::WRITE_METHODS, true)) {
            return $this->text('`methode` doit être POST, PUT, PATCH ou DELETE.', true);
        }

        $body = $arguments['corps'] ?? null;

        if ($body !== null && !is_array($body)) {
            return $this->text('`corps` doit être un objet JSON.', true);
        }

        return $this->request($method, $arguments['chemin'] ?? null, $body, $authorization, $clientIp);
    }

    private function request(string $method, mixed $path, ?array $body, string $authorization, ?string $clientIp): array
    {
        if (!is_string($path) || !AssistantRoutes::isAllowed($path, $method)) {
            return $this->text("Ce chemin n'est pas ouvert aux agents (voir `reference_api`). Il commence par / et ne vise ni la connexion, ni les jetons, ni la super-administration, ni les utilisateurs, ni Stripe.", true);
        }

        $response = $this->proxy->call($method, $path, $body, $authorization, $clientIp);

        $text = $response->body === '' ? "HTTP {$response->status}" : $response->body;

        if (mb_strlen($text) > self::MAX_OUTPUT) {
            $text = mb_substr($text, 0, self::MAX_OUTPUT)
                . "\n\n[Réponse coupée à " . self::MAX_OUTPUT . " caractères : demande moins de résultats (per_page) ou une ressource précise.]";
        }

        return $this->text($response->isError() ? "HTTP {$response->status}\n{$text}" : $text, $response->isError());
    }

    private function text(string $text, bool $isError = false): array
    {
        return ['content' => [['type' => 'text', 'text' => $text]], 'isError' => $isError];
    }

    private function result(mixed $id, mixed $result): array
    {
        return ['jsonrpc' => '2.0', 'id' => $id, 'result' => $result];
    }

    private function error(mixed $id, int $code, string $message): array
    {
        return ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $code, 'message' => $message]];
    }
}
