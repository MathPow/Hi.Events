<?php

namespace HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/** What « Ma page » could take from a website or a profile; the organizer chooses before publishing. */
class OrganizerPageSuggestionDTO extends BaseDataObject
{
    public function __construct(
        public readonly string  $source_url,
        /** 'website', 'instagram' or 'platform' */
        public readonly string  $source,
        /** The ticketing service or network hosting the page; what is its own was left out. */
        public readonly ?string $platform,
        public readonly ?string $name,
        public readonly ?string $description,
        public readonly ?string $accent,
        /** data: URL of the image, ready for the draft */
        public readonly ?string $logo,
        public readonly ?string $cover,
        /** @var list<array{platform: string, handle: string}> */
        public readonly array   $social_links,
        /** @var list<array{question: string, answer: string}> */
        public readonly array   $faqs,
        /** The texts were written by the assistant (false: taken as is from the page). */
        public readonly bool    $written_by_assistant,
        /** The page showed little (Instagram without an account, nearly empty site). */
        public readonly bool    $limited,
    )
    {
    }
}
