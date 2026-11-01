<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\EmailTemplate\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class RenderedSampleEmailDTO extends BaseDataObject
{
    public function __construct(
        public readonly string $subject,
        public readonly string $html,
    )
    {
    }
}
