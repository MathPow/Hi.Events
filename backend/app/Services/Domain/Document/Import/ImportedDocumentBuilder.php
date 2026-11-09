<?php

namespace HiEvents\Services\Domain\Document\Import;

use HiEvents\Services\Domain\Document\DocumentBlocks;
use Illuminate\Support\Str;

/**
 * Turns what the model read in a PDF into the editor's blocks. The model
 * writes plain text, with **bold**, *italic*, line breaks and {participant_name}
 * style automatic fields; this makes the editor's rich text of it.
 */
final class ImportedDocumentBuilder
{
    private const TITLE_MAX_LENGTH = 150;

    public function build(array $read, string $fallbackTitle): ImportedDocument
    {
        $blocks = [];

        foreach (is_array($read['blocks'] ?? null) ? $read['blocks'] : [] as $block) {
            $built = is_array($block) ? $this->block($block) : null;
            if ($built !== null) {
                $blocks[] = $built;
            }
        }

        $blocks = array_slice($blocks, 0, DocumentBlocks::MAX_BLOCKS);
        $title = mb_substr(trim(preg_replace('/\s+/u', ' ', (string)($read['title'] ?? ''))), 0, self::TITLE_MAX_LENGTH);

        return new ImportedDocument(
            title: $title !== '' ? $title : mb_substr($fallbackTitle, 0, self::TITLE_MAX_LENGTH),
            audience: ($read['for_minors'] ?? false) === true ? 'MINORS' : 'ALL',
            blocks: $blocks,
        );
    }

    private function block(array $block): ?array
    {
        $type = $block['type'] ?? null;
        $text = trim((string)(is_string($block['text'] ?? null) ? $block['text'] : ''));
        $required = ($block['required'] ?? false) === true;

        return match ($type) {
            DocumentBlocks::TITLE, DocumentBlocks::PARAGRAPH, DocumentBlocks::CLAUSE => $text === '' ? null : [
                'id' => $this->id(),
                'type' => $type,
                'content' => $this->doc($type === DocumentBlocks::CLAUSE ? $this->withoutNumber($text) : $text),
            ],
            DocumentBlocks::CHECKBOX => $text === '' ? null : [
                'id' => $this->id(),
                'type' => $type,
                'content' => $this->doc($text),
                'required' => $required,
            ],
            DocumentBlocks::LIST => $this->list($block),
            DocumentBlocks::FIELD => $text === '' ? null : [
                'id' => $this->id(),
                'type' => $type,
                'label' => mb_substr(rtrim($text, " :_.\t"), 0, DocumentBlocks::LABEL_MAX_LENGTH),
                'required' => $required,
            ],
            DocumentBlocks::SIGNATURE => [
                'id' => $this->id(),
                'type' => $type,
                'signer' => ($block['signer'] ?? null) === DocumentBlocks::SIGNER_GUARDIAN
                    ? DocumentBlocks::SIGNER_GUARDIAN
                    : DocumentBlocks::SIGNER_PARTICIPANT,
            ],
            DocumentBlocks::SEPARATOR => ['id' => $this->id(), 'type' => $type],
            default => null,
        };
    }

    private function list(array $block): ?array
    {
        $items = array_values(array_filter(
            array_map(static fn(mixed $item) => is_string($item) ? trim($item) : '', is_array($block['items'] ?? null) ? $block['items'] : []),
            static fn(string $item) => $item !== '',
        ));
        if ($items === []) {
            return null;
        }

        return [
            'id' => $this->id(),
            'type' => DocumentBlocks::LIST,
            'content' => ['type' => 'doc', 'content' => [[
                'type' => 'bulletList',
                'content' => array_map(fn(string $item) => [
                    'type' => 'listItem',
                    'content' => [$this->paragraph($item)],
                ], $items),
            ]]],
        ];
    }

    /** The editor numbers clauses itself. */
    private function withoutNumber(string $text): string
    {
        return preg_replace('/^(?:\d{1,3}|[a-z]|[ivx]{1,5})[.)]\s+/iu', '', $text) ?? $text;
    }

    private function doc(string $text): array
    {
        $paragraphs = array_values(array_filter(
            array_map('trim', preg_split('/\n\s*\n/u', $text) ?: []),
            static fn(string $paragraph) => $paragraph !== '',
        ));

        return ['type' => 'doc', 'content' => array_map(fn(string $paragraph) => $this->paragraph($paragraph), $paragraphs)];
    }

    private function paragraph(string $text): array
    {
        $content = $this->inline($text, []);

        return $content === [] ? ['type' => 'paragraph'] : ['type' => 'paragraph', 'content' => $content];
    }

    /**
     * Bold, italic, automatic fields and line breaks, the rest as text.
     */
    private function inline(string $text, array $marks): array
    {
        $fields = implode('|', DocumentBlocks::AUTO_FIELDS);
        $parts = preg_split(
            '/(\*\*.+?\*\*|(?<![*\w])\*(?!\s)[^*\n]+?(?<!\s)\*(?![*\w])|\{(?:' . $fields . ')\}|\n)/us',
            $text,
            flags: PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY,
        ) ?: [];

        $nodes = [];
        foreach ($parts as $part) {
            if ($part === "\n") {
                $nodes[] = ['type' => 'hardBreak'];
            } elseif (preg_match('/^\{(' . $fields . ')\}$/u', $part, $match)) {
                $nodes[] = ['type' => 'field', 'attrs' => ['key' => $match[1]]];
            } elseif (str_starts_with($part, '**') && str_ends_with($part, '**') && mb_strlen($part) > 4) {
                array_push($nodes, ...$this->inline(mb_substr($part, 2, -2), $this->withMark($marks, 'bold')));
            } elseif (str_starts_with($part, '*') && str_ends_with($part, '*') && mb_strlen($part) > 2) {
                array_push($nodes, ...$this->inline(mb_substr($part, 1, -1), $this->withMark($marks, 'italic')));
            } else {
                $node = ['type' => 'text', 'text' => $part];
                if ($marks !== []) {
                    $node['marks'] = array_map(static fn(string $mark) => ['type' => $mark], $marks);
                }
                $nodes[] = $node;
            }
        }

        return $nodes;
    }

    private function withMark(array $marks, string $mark): array
    {
        return in_array($mark, $marks, true) ? $marks : [...$marks, $mark];
    }

    private function id(): string
    {
        return 'b' . Str::lower(Str::random(10));
    }
}
