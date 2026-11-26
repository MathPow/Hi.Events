<?php

namespace HiEvents\Services\Domain\Mcp;

use HiEvents\Services\Domain\Assistant\AssistantRoutes;
use HiEvents\Services\Domain\Mcp\DTO\McpApiResponseDTO;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;

/**
 * Rejoue un appel d'outil MCP sur l'API de la billetterie, dans le même processus, avec
 * l'autorisation de la requête MCP. Il passe par toute la pile (authentification,
 * contexte du compte, rôles, validation) et porte l'en-tête de l'assistant : le serveur
 * n'y laisse passer que les routes de AssistantRoutes, comme pour l'assistant intégré.
 */
class McpApiProxy
{
    public function __construct(
        private readonly Application $app,
        private readonly Kernel      $kernel,
    )
    {
    }

    public function call(string $method, string $path, ?array $body, string $authorization, ?string $clientIp): McpApiResponseDTO
    {
        $server = [
            'HTTP_AUTHORIZATION' => $authorization,
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_' . strtoupper(str_replace('-', '_', AssistantRoutes::HEADER)) => 'mcp',
            'REMOTE_ADDR' => $clientIp ?? '127.0.0.1',
        ];

        if ($body !== null) {
            $server['CONTENT_TYPE'] = 'application/json';
        }

        $subRequest = Request::create(
            uri: $path,
            method: $method,
            server: $server,
            content: $body !== null ? json_encode($body, JSON_UNESCAPED_UNICODE) : null,
        );

        $original = $this->app->make('request');

        try {
            $response = $this->kernel->handle($subRequest);
        } finally {
            $this->app->instance('request', $original);
            Facade::clearResolvedInstance('request');
        }

        return new McpApiResponseDTO(
            status: $response->getStatusCode(),
            body: (string)$response->getContent(),
        );
    }
}
