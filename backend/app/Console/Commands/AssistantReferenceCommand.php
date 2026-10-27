<?php

namespace HiEvents\Console\Commands;

use BackedEnum;
use Closure;
use HiEvents\Services\Domain\Assistant\AssistantRoutes;
use Illuminate\Console\Command;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Routing\Route;
use Illuminate\Routing\Router;
use ReflectionClass;
use ReflectionNamedType;
use Stringable;
use Throwable;
use UnitEnum;

/**
 * Ecrit la reference de l'API que lit l'assistant des organisateurs
 * (resources/assistant/reference-api.md) : chaque route de l'espace
 * organisateur avec les champs acceptes et leurs regles de validation, lues
 * dans les FormRequest. A relancer apres un changement de route ou de regle,
 * puis a commiter avec le reste :
 *
 *   php artisan assistant:reference
 */
class AssistantReferenceCommand extends Command
{
    protected $signature = 'assistant:reference';

    protected $description = 'Write the API reference read by the organizer assistant';

    public function handle(Router $router): int
    {
        $routes = collect($router->getRoutes()->getRoutes())
            ->filter(fn(Route $route) => $this->isOrganizerRoute($route))
            ->sortBy(fn(Route $route) => $route->uri() . ' ' . $this->method($route));

        $lines = [];
        foreach ($routes as $route) {
            $lines[] = $this->method($route) . ' /' . $route->uri();
            foreach ($this->describe($route) as $line) {
                $lines[] = '  ' . $line;
            }
        }

        $path = base_path(AssistantRoutes::REFERENCE_PATH);
        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }
        file_put_contents($path, implode("\n", $lines) . "\n");

        $this->info(sprintf('%d routes written to %s', $routes->count(), AssistantRoutes::REFERENCE_PATH));

        return self::SUCCESS;
    }

    private function isOrganizerRoute(Route $route): bool
    {
        $authenticated = collect($route->gatherMiddleware())
            ->contains(fn($middleware) => is_string($middleware) && str_ends_with($middleware, ':api')
                && (str_starts_with($middleware, 'auth') || str_contains($middleware, 'Authenticate')));

        return $authenticated && AssistantRoutes::isAllowed('/' . $route->uri());
    }

    private function method(Route $route): string
    {
        return collect($route->methods())->reject(fn($method) => $method === 'HEAD')->implode('|');
    }

    /**
     * Les champs du corps (regles du FormRequest) et, pour une liste, les
     * parametres de pagination et de filtre.
     *
     * @return string[]
     */
    private function describe(Route $route): array
    {
        $action = $route->getActionName();
        $class = str_contains($action, '@') ? strstr($action, '@', true) : $action;
        if (!class_exists($class)) {
            return [];
        }

        $lines = [];
        $source = (string)@file_get_contents((new ReflectionClass($class))->getFileName());
        if (str_contains($source, 'filterableResourceResponse') || str_contains($source, 'QueryParamsDTO')) {
            $lines[] = 'liste : page, per_page, query, sort_by, sort_direction, '
                . 'filter_fields[champ][eq|ne|lt|lte|gt|gte|like|in]=valeur (champs permis dans meta.allowed_filter_fields)';
        }

        $request = $this->formRequestOf($class);
        if ($request === null) {
            return $lines;
        }

        try {
            $instance = new $request();
            $instance->setContainer(app());
            $rules = method_exists($instance, 'rules') ? app()->call([$instance, 'rules']) : [];
        } catch (Throwable) {
            return $lines;
        }

        foreach ($rules as $field => $rule) {
            $lines[] = $field . ': ' . $this->shorten($this->rule($rule));
        }

        return $lines;
    }

    /** Une longue liste de valeurs (les 150 devises) : les premieres seulement. */
    private function shorten(string $rule): string
    {
        return preg_replace_callback('/in:((?:"[^"]*",?){16,})/', function (array $match) {
            $values = explode(',', $match[1]);

            return 'in:' . implode(',', array_slice($values, 0, 6)) . sprintf(',… (%d valeurs)', count($values));
        }, $rule) ?? $rule;
    }

    /** @return class-string<FormRequest>|null */
    private function formRequestOf(string $class): ?string
    {
        if (!method_exists($class, '__invoke')) {
            return null;
        }

        foreach ((new ReflectionClass($class))->getMethod('__invoke')->getParameters() as $parameter) {
            $type = $parameter->getType();
            if ($type instanceof ReflectionNamedType && !$type->isBuiltin()
                && is_subclass_of($type->getName(), FormRequest::class)) {
                return $type->getName();
            }
        }

        return null;
    }

    private function rule(mixed $rule): string
    {
        if (is_string($rule)) {
            return $rule;
        }
        if (is_array($rule)) {
            return implode('|', array_map(fn($part) => $this->rule($part), $rule));
        }
        if ($rule instanceof Closure) {
            return 'custom';
        }

        // Rule::enum() n'a pas de forme texte : on donne ses valeurs.
        if (is_object($rule) && property_exists($rule, 'type')) {
            $type = (fn() => $this->type)->call($rule);
            if (is_string($type) && enum_exists($type)) {
                return 'in:' . implode(',', array_map(
                    fn(UnitEnum $case) => $case instanceof BackedEnum ? $case->value : $case->name,
                    $type::cases(),
                ));
            }
        }

        if ($rule instanceof Stringable) {
            try {
                return (string)$rule;
            } catch (Throwable) {
                // Une regle qui a besoin de la requete pour s'ecrire.
            }
        }

        return class_basename($rule);
    }
}
