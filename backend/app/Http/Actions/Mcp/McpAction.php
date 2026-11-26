<?php

namespace HiEvents\Http\Actions\Mcp;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Mcp\McpMessageHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Le serveur MCP de la billetterie (transport « Streamable HTTP », sans session ni flux) :
 * un agent s'y branche avec un jeton d'API (Réglages de l'organisateur → Équipe) et lit ou
 * modifie la billetterie avec les droits de ce jeton. Voir McpMessageHandler.
 */
class McpAction extends BaseAction
{
    public function __construct(private readonly McpMessageHandler $handler)
    {
    }

    public function __invoke(Request $request): JsonResponse|Response
    {
        if (!$request->isMethod('POST')) {
            return $this->jsonResponse(['message' => __('This MCP server answers POST requests only.')], Response::HTTP_METHOD_NOT_ALLOWED)
                ->header('Allow', 'POST');
        }

        $payload = json_decode($request->getContent(), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return $this->jsonResponse(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32700, 'message' => 'Parse error']]);
        }

        $authorization = (string)$request->headers->get('Authorization');
        $clientIp = $this->getClientIp($request);

        if (is_array($payload) && array_is_list($payload) && $payload !== []) {
            $responses = array_values(array_filter(array_map(
                fn($message) => $this->handler->handle($message, $authorization, $clientIp),
                $payload,
            )));

            return $responses === [] ? $this->noContentResponse(Response::HTTP_ACCEPTED) : $this->jsonResponse($responses);
        }

        $response = $this->handler->handle($payload, $authorization, $clientIp);

        return $response === null ? $this->noContentResponse(Response::HTTP_ACCEPTED) : $this->jsonResponse($response);
    }
}
