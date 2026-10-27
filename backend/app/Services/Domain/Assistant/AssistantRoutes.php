<?php

namespace HiEvents\Services\Domain\Assistant;

/**
 * Les routes de l'API que l'assistant des organisateurs connait. Il lit et
 * modifie par la session de la personne connectee (dans son navigateur) : il
 * n'a donc jamais plus de droits qu'elle. On lui cache seulement ce qui ne
 * sert pas a tenir une billetterie ou qui toucherait a la connexion.
 * Le navigateur applique la meme liste (components/common/Assistant).
 */
class AssistantRoutes
{
    public const REFERENCE_PATH = 'resources/assistant/reference-api.md';

    /** Connexion, jetons d'application, super-administration, pages publiques et l'assistant lui-meme. */
    public const BLOCKED_PREFIXES = ['/auth', '/api-tokens', '/admin', '/public', '/assistant'];

    public static function isAllowed(string $path): bool
    {
        $path = strtok($path, '?') ?: '';

        if (!str_starts_with($path, '/') || str_starts_with($path, '//')
            || str_contains($path, '..') || str_contains($path, '\\')) {
            return false;
        }

        foreach (self::BLOCKED_PREFIXES as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                return false;
            }
        }

        return true;
    }
}
