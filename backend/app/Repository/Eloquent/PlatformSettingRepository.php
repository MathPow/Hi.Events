<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\PlatformSettingDomainObject;
use HiEvents\Models\PlatformSetting;
use HiEvents\Repository\Interfaces\PlatformSettingRepositoryInterface;

/**
 * @extends BaseRepository<PlatformSettingDomainObject>
 */
class PlatformSettingRepository extends BaseRepository implements PlatformSettingRepositoryInterface
{
    protected function getModel(): string
    {
        return PlatformSetting::class;
    }

    public function getDomainObject(): string
    {
        return PlatformSettingDomainObject::class;
    }

    public function getValue(string $key): ?string
    {
        return PlatformSetting::query()->where('key', $key)->value('value');
    }

    public function setValue(string $key, ?string $value): void
    {
        PlatformSetting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
