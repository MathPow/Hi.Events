<?php

namespace HiEvents\Services\Domain\Document\Import;

use HiEvents\DataTransferObjects\BaseDataObject;

class ImportedDocument extends BaseDataObject
{
    public function __construct(
        public readonly string $title,
        public readonly string $audience,
        /** @var array[] the editor's blocks, before DocumentBlocks::normalize */
        public readonly array  $blocks,
    )
    {
    }
}
