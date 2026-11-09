<?php

namespace HiEvents\Services\Domain\Waiver\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class PendingSignaturesDTO extends BaseDataObject
{
    /**
     * @param string|null $waiver_text The event's waiver, when the participant has yet to sign it.
     * @param array<int, array> $documents The online documents' copies left to sign.
     */
    public function __construct(
        public readonly ?string $waiver_text,
        public readonly bool    $waiver_is_minor,
        public readonly array   $documents,
    )
    {
    }

    public function isEmpty(): bool
    {
        return $this->waiver_text === null && $this->documents === [];
    }
}
