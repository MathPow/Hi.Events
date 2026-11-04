<?php

namespace HiEvents\Http\Middleware;

use Closure;
use HiEvents\Services\Domain\Assistant\AssistantRoutes;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Les appels de l'assistant (en-tete X-Dehors-Assistant, pose par le navigateur
 * et hors de portee du modele) ne passent que sur les routes qu'il a le droit
 * d'utiliser, quel que soit l'encodage du chemin.
 */
class RestrictAssistantRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->headers->has(AssistantRoutes::HEADER) || $request->isMethod('OPTIONS')) {
            return $next($request);
        }

        $path = '/'.ltrim($request->decodedPath(), '/');

        if (! AssistantRoutes::isAllowed($path, $request->method())) {
            abort(Response::HTTP_FORBIDDEN, __('This part of the ticketing is not open to the assistant.'));
        }

        return $next($request);
    }
}
