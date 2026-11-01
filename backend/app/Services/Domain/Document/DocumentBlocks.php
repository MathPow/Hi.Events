<?php

namespace HiEvents\Services\Domain\Document;

use Illuminate\Validation\ValidationException;

/**
 * The blocks of an organizer's document, as the editor saves them:
 *
 *   title, paragraph, clause, checkbox  { id, type, content: <rich text> }   (checkbox: + required)
 *   list                                { id, type, content: <rich text with a bullet list> }
 *   field                               { id, type, label, required }        a line to fill in
 *   signature                           { id, type, signer: participant|guardian }
 *   separator                           { id, type }
 *
 * Rich text is the editor's (TipTap) JSON: a doc of paragraphs (and bullet
 * lists for the list block) holding text in bold or italic, line breaks and
 * automatic fields ({type: field, attrs: {key}}) filled in for each
 * participant. Anything else is dropped, so what is stored is always safe to
 * render.
 */
final class DocumentBlocks
{
    public const TITLE = 'title';
    public const PARAGRAPH = 'paragraph';
    public const CLAUSE = 'clause';
    public const LIST = 'list';
    public const FIELD = 'field';
    public const CHECKBOX = 'checkbox';
    public const SIGNATURE = 'signature';
    public const SEPARATOR = 'separator';

    public const TYPES = [
        self::TITLE, self::PARAGRAPH, self::CLAUSE, self::LIST,
        self::FIELD, self::CHECKBOX, self::SIGNATURE, self::SEPARATOR,
    ];

    public const SIGNER_PARTICIPANT = 'participant';
    public const SIGNER_GUARDIAN = 'guardian';

    // Filled in for each participant at checkout.
    public const AUTO_FIELDS = ['participant_name', 'date_of_birth', 'event_name', 'event_date', 'organizer_name'];

    // The participant's typed name when the document has no participant signature block.
    public const IMPLICIT_SIGNATURE = '_signature';

    public const MAX_BLOCKS = 150;
    public const LABEL_MAX_LENGTH = 150;
    public const ANSWER_MAX_LENGTH = 1000;
    public const NAME_MAX_LENGTH = 100;
    private const TEXT_MAX_LENGTH = 5000;
    private const MAX_JSON_BYTES = 300_000;
    private const MARKS = ['bold', 'italic'];

    /**
     * @throws ValidationException
     */
    public static function normalize(mixed $blocks): array
    {
        if (!is_array($blocks) || !array_is_list($blocks)) {
            self::fail(__('The document could not be read.'));
        }

        if (count($blocks) > self::MAX_BLOCKS) {
            self::fail(__('A document can have at most :max blocks.', ['max' => self::MAX_BLOCKS]));
        }

        $normalized = [];
        $ids = [];

        foreach ($blocks as $block) {
            $id = is_array($block) ? ($block['id'] ?? null) : null;
            $type = is_array($block) ? ($block['type'] ?? null) : null;

            if (!is_string($id) || !preg_match('/^[A-Za-z0-9_-]{1,40}$/', $id) || isset($ids[$id])
                || !in_array($type, self::TYPES, true)) {
                self::fail(__('The document could not be read.'));
            }
            $ids[$id] = true;

            $normalized[] = match ($type) {
                self::TITLE, self::PARAGRAPH, self::CLAUSE => [
                    'id' => $id,
                    'type' => $type,
                    'content' => self::richText($block['content'] ?? null, false),
                ],
                self::LIST => [
                    'id' => $id,
                    'type' => $type,
                    'content' => self::richText($block['content'] ?? null, true),
                ],
                self::CHECKBOX => [
                    'id' => $id,
                    'type' => $type,
                    'content' => self::richText($block['content'] ?? null, false),
                    'required' => (bool)($block['required'] ?? false),
                ],
                self::FIELD => [
                    'id' => $id,
                    'type' => $type,
                    'label' => mb_substr(trim((string)(is_scalar($block['label'] ?? null) ? $block['label'] : '')), 0, self::LABEL_MAX_LENGTH),
                    'required' => (bool)($block['required'] ?? false),
                ],
                self::SIGNATURE => [
                    'id' => $id,
                    'type' => $type,
                    'signer' => ($block['signer'] ?? null) === self::SIGNER_GUARDIAN ? self::SIGNER_GUARDIAN : self::SIGNER_PARTICIPANT,
                ],
                self::SEPARATOR => ['id' => $id, 'type' => $type],
            };
        }

        if (strlen((string)json_encode($normalized)) > self::MAX_JSON_BYTES) {
            self::fail(__('The document is too long.'));
        }

        return $normalized;
    }

    /**
     * @return array[] The blocks of a type.
     */
    public static function ofType(array $blocks, string $type): array
    {
        return array_values(array_filter($blocks, static fn(array $block) => $block['type'] === $type));
    }

    public static function signatures(array $blocks, string $signer): array
    {
        return array_values(array_filter(
            self::ofType($blocks, self::SIGNATURE),
            static fn(array $block) => $block['signer'] === $signer,
        ));
    }

    /**
     * Whether the participant signs in an added signature line: the document
     * has no participant signature block, and no parent signs it either.
     */
    public static function needsImplicitSignature(array $blocks, bool $guardianSigns): bool
    {
        return self::signatures($blocks, self::SIGNER_PARTICIPANT) === []
            && !($guardianSigns && self::signatures($blocks, self::SIGNER_GUARDIAN) !== []);
    }

    /**
     * Whether filling the document needs the participant's date of birth: the
     * date is printed in it, it is for minors only, or a parent signs for a
     * minor.
     */
    public static function needsBirthDate(array $blocks, string $audience): bool
    {
        return $audience === 'MINORS'
            || self::signatures($blocks, self::SIGNER_GUARDIAN) !== []
            || self::usesAutoField($blocks, 'date_of_birth');
    }

    public static function usesAutoField(array $blocks, string $key): bool
    {
        $walk = static function (mixed $node) use (&$walk, $key): bool {
            if (!is_array($node)) {
                return false;
            }
            if (($node['type'] ?? null) === 'field' && ($node['attrs']['key'] ?? null) === $key) {
                return true;
            }
            foreach ($node['content'] ?? [] as $child) {
                if ($walk($child)) {
                    return true;
                }
            }

            return false;
        };

        foreach ($blocks as $block) {
            if (isset($block['content']) && $walk($block['content'])) {
                return true;
            }
        }

        return false;
    }

    /**
     * An empty document of the given rich text kind.
     */
    public static function emptyRichText(bool $list = false): array
    {
        return $list
            ? ['type' => 'doc', 'content' => [['type' => 'bulletList', 'content' => [
                ['type' => 'listItem', 'content' => [['type' => 'paragraph']]],
            ]]]]
            : ['type' => 'doc', 'content' => [['type' => 'paragraph']]];
    }

    private static function richText(mixed $doc, bool $allowList): array
    {
        $content = [];

        foreach ((is_array($doc) && is_array($doc['content'] ?? null)) ? $doc['content'] : [] as $node) {
            $type = is_array($node) ? ($node['type'] ?? null) : null;

            if ($type === 'paragraph') {
                $content[] = self::paragraph($node);
            } elseif ($type === 'bulletList' && $allowList) {
                $items = [];
                foreach (is_array($node['content'] ?? null) ? $node['content'] : [] as $item) {
                    if (!is_array($item) || ($item['type'] ?? null) !== 'listItem') {
                        continue;
                    }
                    $paragraphs = array_values(array_map(
                        static fn(array $paragraph) => self::paragraph($paragraph),
                        array_filter(
                            is_array($item['content'] ?? null) ? $item['content'] : [],
                            static fn(mixed $child) => is_array($child) && ($child['type'] ?? null) === 'paragraph',
                        ),
                    ));
                    $items[] = ['type' => 'listItem', 'content' => $paragraphs ?: [['type' => 'paragraph']]];
                }
                if ($items) {
                    $content[] = ['type' => 'bulletList', 'content' => $items];
                }
            }
        }

        if ($content === []) {
            return self::emptyRichText($allowList);
        }

        return ['type' => 'doc', 'content' => $content];
    }

    private static function paragraph(array $node): array
    {
        $inline = [];

        foreach (is_array($node['content'] ?? null) ? $node['content'] : [] as $child) {
            $type = is_array($child) ? ($child['type'] ?? null) : null;

            if ($type === 'text' && is_string($child['text'] ?? null) && $child['text'] !== '') {
                $text = ['type' => 'text', 'text' => mb_substr($child['text'], 0, self::TEXT_MAX_LENGTH)];
                $marks = array_values(array_filter(
                    array_map(
                        static fn(mixed $mark) => is_array($mark) && in_array($mark['type'] ?? null, self::MARKS, true) ? ['type' => $mark['type']] : null,
                        is_array($child['marks'] ?? null) ? $child['marks'] : [],
                    ),
                ));
                if ($marks) {
                    $text['marks'] = array_values(array_unique($marks, SORT_REGULAR));
                }
                $inline[] = $text;
            } elseif ($type === 'hardBreak') {
                $inline[] = ['type' => 'hardBreak'];
            } elseif ($type === 'field' && in_array($child['attrs']['key'] ?? null, self::AUTO_FIELDS, true)) {
                $inline[] = ['type' => 'field', 'attrs' => ['key' => $child['attrs']['key']]];
            }
        }

        return $inline ? ['type' => 'paragraph', 'content' => $inline] : ['type' => 'paragraph'];
    }

    /**
     * @throws ValidationException
     */
    private static function fail(string $message): never
    {
        throw ValidationException::withMessages(['blocks' => $message]);
    }
}
