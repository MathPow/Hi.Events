<?php

namespace HiEvents\Services\Infrastructure\WebPage;

use HiEvents\DataTransferObjects\BaseDataObject;

class FetchedWebPage extends BaseDataObject
{
    public function __construct(
        /** After the redirects. */
        public readonly string  $url,
        public readonly string  $contentType,
        public readonly ?string $charset,
        public readonly string  $body,
    )
    {
    }

    public function isHtml(): bool
    {
        return in_array($this->contentType, ['text/html', 'application/xhtml+xml'], true);
    }
}
