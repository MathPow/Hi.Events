<?php

namespace HiEvents\Services\Domain\Document;

/**
 * Turns a document's blocks (DocumentBlocks) into the HTML of its PDF: blank
 * for the organizer's preview, filled with a participant's details to print,
 * or with their answers and typed signatures once signed online. All text is
 * escaped: the blocks hold no HTML of their own.
 */
class DocumentRenderer
{
    public function render(array $blocks, DocumentRenderContext $context): string
    {
        $html = [];
        $clauseNumber = 0;

        foreach ($blocks as $block) {
            $html[] = match ($block['type']) {
                DocumentBlocks::TITLE => '<h1>' . $this->inlineOfAll($block['content'], $context) . '</h1>',
                DocumentBlocks::PARAGRAPH => $this->paragraphs($block['content'], $context),
                DocumentBlocks::CLAUSE => sprintf(
                    '<table class="clause"><tr><td class="clause-number">%d.</td><td>%s</td></tr></table>',
                    ++$clauseNumber,
                    $this->paragraphs($block['content'], $context),
                ),
                DocumentBlocks::LIST => $this->paragraphs($block['content'], $context),
                DocumentBlocks::FIELD => $this->field($block, $context),
                DocumentBlocks::CHECKBOX => $this->checkbox($block, $context),
                DocumentBlocks::SIGNATURE => $this->signature($block['signer'], $context->answers[$block['id']] ?? null, $context),
                DocumentBlocks::SEPARATOR => '<hr>',
                default => '',
            };
        }

        // When no one signs in a block of the document, the participant signs at the end.
        if (DocumentBlocks::needsImplicitSignature($blocks, $context->showGuardian)) {
            $html[] = $this->signature(
                DocumentBlocks::SIGNER_PARTICIPANT,
                $context->answers[DocumentBlocks::IMPLICIT_SIGNATURE] ?? null,
                $context,
            );
        }

        return implode("\n", array_filter($html));
    }

    public static function autoFieldLabel(string $key): string
    {
        return match ($key) {
            'participant_name' => __('Participant name'),
            'date_of_birth' => __('Date of birth'),
            'event_name' => __('Event name'),
            'event_date' => __('Event date'),
            'organizer_name' => __('Organizer'),
            default => '',
        };
    }

    private function field(array $block, DocumentRenderContext $context): string
    {
        $answer = $context->answers[$block['id']] ?? null;
        $answer = is_string($answer) && trim($answer) !== '' ? nl2br(e(trim($answer))) : '&nbsp;';

        return sprintf(
            '<div class="field"><div class="field-label">%s</div><div class="field-line">%s</div></div>',
            e($block['label'] !== '' ? $block['label'] : __('Answer')),
            $answer,
        );
    }

    private function checkbox(array $block, DocumentRenderContext $context): string
    {
        $checked = ($context->answers[$block['id']] ?? false) === true;

        return sprintf(
            '<table class="check"><tr><td class="check-box">%s</td><td>%s</td></tr></table>',
            $checked ? '&#9745;' : '&#9744;',
            $this->inlineOfAll($block['content'], $context),
        );
    }

    private function signature(string $signer, mixed $name, DocumentRenderContext $context): string
    {
        if ($signer === DocumentBlocks::SIGNER_GUARDIAN && !$context->showGuardian) {
            return '';
        }

        $name = is_string($name) ? trim($name) : '';
        $signed = $name !== '' && $context->signedOn !== null;

        return sprintf(
            '<table class="signature"><tr><td class="line">%s</td><td class="gap"></td><td class="line">%s</td><td class="gap"></td><td class="line">%s</td></tr>'
            . '<tr><td class="caption">%s</td><td></td><td class="caption">%s</td><td></td><td class="caption">%s</td></tr></table>',
            $signed ? e($name) : '&nbsp;',
            $signed ? '<span class="typed">' . e($name) . '</span>' : '&nbsp;',
            $signed ? e($context->signedOn) : '&nbsp;',
            e($signer === DocumentBlocks::SIGNER_GUARDIAN ? __('Name of parent or guardian') : __('Participant name')),
            e(__('Signature')),
            e(__('Date')),
        );
    }

    /**
     * The paragraphs and bullet lists of a rich text block.
     */
    private function paragraphs(array $doc, DocumentRenderContext $context): string
    {
        $html = '';

        foreach ($doc['content'] ?? [] as $node) {
            if ($node['type'] === 'paragraph') {
                $inline = $this->inline($node, $context);
                $html .= '<p>' . ($inline !== '' ? $inline : '&nbsp;') . '</p>';
            } elseif ($node['type'] === 'bulletList') {
                $html .= '<ul>';
                foreach ($node['content'] ?? [] as $item) {
                    $html .= '<li>' . implode('<br>', array_map(
                            fn(array $paragraph) => $this->inline($paragraph, $context),
                            $item['content'] ?? [],
                        )) . '</li>';
                }
                $html .= '</ul>';
            }
        }

        return $html;
    }

    /**
     * Every paragraph of a one-line block (title, checkbox), on separate lines.
     */
    private function inlineOfAll(array $doc, DocumentRenderContext $context): string
    {
        return implode('<br>', array_map(
            fn(array $paragraph) => $this->inline($paragraph, $context),
            array_filter($doc['content'] ?? [], static fn(array $node) => $node['type'] === 'paragraph'),
        ));
    }

    private function inline(array $paragraph, DocumentRenderContext $context): string
    {
        $html = '';

        foreach ($paragraph['content'] ?? [] as $node) {
            if ($node['type'] === 'text') {
                $text = e($node['text']);
                foreach ($node['marks'] ?? [] as $mark) {
                    $text = $mark['type'] === 'bold' ? "<strong>$text</strong>" : "<em>$text</em>";
                }
                $html .= $text;
            } elseif ($node['type'] === 'hardBreak') {
                $html .= '<br>';
            } elseif ($node['type'] === 'field') {
                $html .= $this->autoField($node['attrs']['key'], $context);
            }
        }

        return $html;
    }

    private function autoField(string $key, DocumentRenderContext $context): string
    {
        $value = $context->autoValues[$key] ?? null;

        if (is_string($value) && $value !== '') {
            return '<span class="auto">' . e($value) . '</span>';
        }

        // Blank, to fill in by hand: the field's name under the line.
        return '<span class="blank">' . e(self::autoFieldLabel($key)) . '</span>';
    }
}
