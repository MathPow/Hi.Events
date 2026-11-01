<?php

namespace Tests\Unit\Services\Domain\Document;

use HiEvents\Services\Domain\Document\DocumentBlocks;
use HiEvents\Services\Domain\Document\DocumentTemplates;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DocumentBlocksTest extends TestCase
{
    public function testKeepsOnlyKnownNodesMarksAndFields(): void
    {
        $blocks = DocumentBlocks::normalize([[
            'id' => 'b1',
            'type' => 'paragraph',
            'extra' => 'dropped',
            'content' => ['type' => 'doc', 'content' => [[
                'type' => 'paragraph',
                'content' => [
                    ['type' => 'text', 'text' => 'Bonjour ', 'marks' => [['type' => 'bold'], ['type' => 'link', 'attrs' => ['href' => 'javascript:alert(1)']]]],
                    ['type' => 'field', 'attrs' => ['key' => 'participant_name']],
                    ['type' => 'field', 'attrs' => ['key' => 'password']],
                    ['type' => 'image', 'attrs' => ['src' => 'x']],
                    ['type' => 'hardBreak'],
                ],
            ], [
                'type' => 'bulletList',
                'content' => [],
            ]]],
        ]]);

        $this->assertSame([[
            'id' => 'b1',
            'type' => 'paragraph',
            'content' => ['type' => 'doc', 'content' => [[
                'type' => 'paragraph',
                'content' => [
                    ['type' => 'text', 'text' => 'Bonjour ', 'marks' => [['type' => 'bold']]],
                    ['type' => 'field', 'attrs' => ['key' => 'participant_name']],
                    ['type' => 'hardBreak'],
                ],
            ]]],
        ]], $blocks);
    }

    public function testListsOnlyInListBlocks(): void
    {
        $list = ['type' => 'doc', 'content' => [[
            'type' => 'bulletList',
            'content' => [['type' => 'listItem', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Un']]]]]],
        ]]];

        [$listBlock, $paragraphBlock] = DocumentBlocks::normalize([
            ['id' => 'l', 'type' => 'list', 'content' => $list],
            ['id' => 'p', 'type' => 'paragraph', 'content' => $list],
        ]);

        $this->assertSame($list, $listBlock['content']);
        $this->assertSame(DocumentBlocks::emptyRichText(), $paragraphBlock['content']);
    }

    public function testFieldsSignaturesAndSeparators(): void
    {
        $this->assertSame([
            ['id' => 'f', 'type' => 'field', 'label' => 'Allergies', 'required' => true],
            ['id' => 's', 'type' => 'signature', 'signer' => 'guardian'],
            ['id' => 't', 'type' => 'signature', 'signer' => 'participant'],
            ['id' => 'h', 'type' => 'separator'],
        ], DocumentBlocks::normalize([
            ['id' => 'f', 'type' => 'field', 'label' => '  Allergies ', 'required' => 1],
            ['id' => 's', 'type' => 'signature', 'signer' => 'guardian'],
            ['id' => 't', 'type' => 'signature', 'signer' => 'someone'],
            ['id' => 'h', 'type' => 'separator', 'content' => 'x'],
        ]));
    }

    public function testRejectsUnknownTypesAndDuplicateIds(): void
    {
        foreach ([
                     [['id' => 'a', 'type' => 'script']],
                     [['id' => 'a', 'type' => 'separator'], ['id' => 'a', 'type' => 'separator']],
                     [['id' => 'a b', 'type' => 'separator']],
                     ['not a list' => ['id' => 'a', 'type' => 'separator']],
                 ] as $blocks) {
            try {
                DocumentBlocks::normalize($blocks);
                $this->fail('Expected a validation error for ' . json_encode($blocks));
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('blocks', $exception->errors());
            }
        }
    }

    public function testWhatNeedsTheDateOfBirth(): void
    {
        $guardian = DocumentBlocks::normalize([['id' => 's', 'type' => 'signature', 'signer' => 'guardian']]);
        $participant = DocumentBlocks::normalize([['id' => 's', 'type' => 'signature', 'signer' => 'participant']]);

        $this->assertTrue(DocumentBlocks::needsBirthDate($guardian, 'ALL'));
        $this->assertTrue(DocumentBlocks::needsBirthDate($participant, 'MINORS'));
        $this->assertFalse(DocumentBlocks::needsBirthDate($participant, 'ALL'));
        $this->assertFalse(DocumentBlocks::needsImplicitSignature($guardian, true));
        $this->assertTrue(DocumentBlocks::needsImplicitSignature($guardian, false));
        $this->assertFalse(DocumentBlocks::needsImplicitSignature($participant, false));
    }

    public function testEveryTemplateIsValidInBothLanguages(): void
    {
        foreach (DocumentTemplates::KEYS as $key) {
            foreach (['fr', 'en'] as $locale) {
                $template = DocumentTemplates::make($key, $locale);

                $this->assertSame($template['blocks'], DocumentBlocks::normalize($template['blocks']), "$key ($locale)");
                $this->assertNotSame('', $template['title']);
            }
        }

        $this->assertSame('MINORS', DocumentTemplates::make(DocumentTemplates::PARENTAL_CONSENT, 'fr')['audience']);
    }
}
