<?php

namespace HiEvents\Services\Domain\Document;

/**
 * What fills a document when it is rendered (DocumentRenderer).
 */
final class DocumentRenderContext
{
    /**
     * @param array<string, string>|null $autoValues The participant's automatic fields; null for the blank document.
     * @param array<string, mixed>|null $answers The participant's answers by block id; null when not signed.
     * @param bool $showGuardian Whether the parent or guardian signature lines are part of this copy.
     * @param string|null $signedOn The date of the online signature, shown on its lines.
     */
    public function __construct(
        public readonly ?array  $autoValues = null,
        public readonly ?array  $answers = null,
        public readonly bool    $showGuardian = true,
        public readonly ?string $signedOn = null,
    )
    {
    }
}
