<?php

namespace HiEvents\Services\Domain\Assistant;

/**
 * Les routes de l'API que l'assistant des organisateurs connait. Il lit et
 * modifie par la session de la personne connectee (dans son navigateur) : il
 * n'a donc jamais plus de droits qu'elle. On lui cache en plus ce qui ne sert
 * pas a tenir une billetterie : la connexion, la super-administration, les
 * utilisateurs du compte et les connexions Stripe.
 *
 * Le navigateur applique la meme liste (components/common/Assistant) et
 * marque chaque appel de l'assistant (en-tete X-Dehors-Assistant) ; le
 * serveur la fait respecter (RestrictAssistantRequests).
 */
class AssistantRoutes
{
    public const REFERENCE_PATH = 'resources/assistant/reference-api.md';

    public const HEADER = 'X-Dehors-Assistant';

    /** Connexion, jetons d'application, super-administration, pages publiques, l'assistant lui-meme et les utilisateurs. */
    public const BLOCKED_PREFIXES = ['/auth', '/api-tokens', '/admin', '/public', '/assistant', '/users'];

    /** Le profil de la personne se lit, sans plus. */
    private const READABLE_EXCEPTIONS = ['/users/me'];

    /** Connecter ou deconnecter Stripe : l'argent de l'organisateur. */
    private const BLOCKED_PATTERNS = ['#^/accounts/[^/]+/stripe(/|$)#', '#^/organizers/[^/]+/stripe(/|$)#'];

    public static function isAllowed(string $path, string $method = 'GET'): bool
    {
        $path = strtok($path, '?') ?: '';

        if (! str_starts_with($path, '/') || str_starts_with($path, '//')
            || str_contains($path, '..') || str_contains($path, '\\') || str_contains($path, '%')) {
            return false;
        }

        $path = rtrim($path, '/') ?: '/';

        if (strtoupper($method) === 'GET' && in_array($path, self::READABLE_EXCEPTIONS, true)) {
            return true;
        }

        foreach (self::BLOCKED_PREFIXES as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return false;
            }
        }

        foreach (self::BLOCKED_PATTERNS as $pattern) {
            if (preg_match($pattern, $path)) {
                return false;
            }
        }

        return true;
    }
}
