<?php

namespace HiEvents\Repository\Interfaces;

use HiEvents\DomainObjects\PlatformSettingDomainObject;

/**
 * @extends RepositoryInterface<PlatformSettingDomainObject>
 */
interface PlatformSettingRepositoryInterface extends RepositoryInterface
{
    /** The setting's value, or null when it was never set. */
    public function getValue(string $key): ?string;

    public function setValue(string $key, ?string $value): void;
}
