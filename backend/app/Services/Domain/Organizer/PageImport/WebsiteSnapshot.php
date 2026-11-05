<?php

namespace HiEvents\Services\Domain\Organizer\PageImport;

use HiEvents\DataTransferObjects\BaseDataObject;

/** What a web page says about its organizer, before any choice. */
class WebsiteSnapshot extends BaseDataObject
{
    public function __construct(
        public readonly string  $url,
        /** @var list<string> */
        public readonly array   $names,
        /** @var list<string> */
        public readonly array   $descriptions,
        public readonly ?string $themeColor,
        /** @var list<string> */
        public readonly array   $logoCandidates,
        /** @var list<string> */
        public readonly array   $coverCandidates,
        /** @var list<array{platform: string, handle: string}> */
        public readonly array   $socialLinks,
        public readonly string  $text,
        /** Who presents the event, when the page declares it (schema.org). */
        public readonly ?string $organizerName = null,
    )
    {
    }
}
