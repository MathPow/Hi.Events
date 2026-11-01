<?php

namespace HiEvents\Services\Domain\Organizer\PageImport;

use HiEvents\DataTransferObjects\BaseDataObject;

class PageTexts extends BaseDataObject
{
    public function __construct(
        public readonly ?string $name,
        public readonly ?string $descriptionHtml,
        /** @var list<array{question: string, answer: string}> */
        public readonly array   $faqs,
    )
    {
    }
}
