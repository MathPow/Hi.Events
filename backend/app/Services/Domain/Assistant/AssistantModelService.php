<?php

namespace HiEvents\Services\Domain\Assistant;

use HiEvents\Repository\Interfaces\PlatformSettingRepositoryInterface;
use Illuminate\Config\Repository;

/**
 * Le modele de l'assistant, pour tous les comptes. Le super admin le choisit
 * dans l'administration ; sans choix, la configuration du serveur
 * (ASSISTANT_MODEL) s'applique.
 */
class AssistantModelService
{
    public const SETTING = 'assistant_model';

    private const FALLBACK_MODEL = 'claude-sonnet-5-5';

    /**
     * Les modeles que l'assistant sait appeler (pensee adaptative, effort,
     * outils), du moins cher au plus capable.
     */
    public const MODELS = [
        'claude-haiku-5-5' => 'Claude Haiku 5.5',
        'claude-sonnet-5-5' => 'Claude Sonnet 5.5',
        'claude-opus-5-5' => 'Claude Opus 5.5',
        'claude-fable-5-1' => 'Claude Fable 5.1',
    ];

    /** Haiku 5.5 n'a pas de repli cote serveur : un refus reste un refus. */
    private const WITHOUT_FALLBACK = ['claude-haiku-5-5'];

    public function __construct(
        private readonly PlatformSettingRepositoryInterface $settingRepository,
        private readonly Repository                         $config,
        private readonly AssistantPricing                   $pricing,
    )
    {
    }

    public function current(): string
    {
        $chosen = $this->settingRepository->getValue(self::SETTING);

        return $chosen !== null && isset(self::MODELS[$chosen]) ? $chosen : $this->default();
    }

    /** Celui de la configuration du serveur. */
    public function default(): string
    {
        $configured = (string)$this->config->get('services.anthropic.assistant_model');

        return $configured !== '' ? $configured : self::FALLBACK_MODEL;
    }

    /** Un modele de la liste, ou null pour revenir a celui du serveur. */
    public function choose(?string $model): void
    {
        if ($model !== null && !isset(self::MODELS[$model])) {
            throw new UnknownAssistantModelException($model);
        }

        $this->settingRepository->setValue(self::SETTING, $model);
    }

    public function supportsFallback(string $model): bool
    {
        return !in_array($model, self::WITHOUT_FALLBACK, true);
    }

    /** @return list<array{id: string, label: string, input: float, output: float, cache_read: float}> */
    public function options(): array
    {
        return array_map(function (string $id) {
            [$input, $output, $cacheRead] = $this->pricing->prices($id);

            return [
                'id' => $id,
                'label' => self::MODELS[$id],
                'input' => $input,
                'output' => $output,
                'cache_read' => $cacheRead,
            ];
        }, array_keys(self::MODELS));
    }
}
