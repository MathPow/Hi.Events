<?php

namespace HiEvents\Services\Domain\Mcp\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class McpApiResponseDTO extends BaseDataObject
{
    public function __construct(
        public readonly int    $status,
        public readonly string $body,
    )
    {
    }

    public function isError(): bool
    {
        return $this->status >= 400;
    }
}
