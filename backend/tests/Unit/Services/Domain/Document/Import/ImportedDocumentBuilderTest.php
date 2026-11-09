<?php

namespace Tests\Unit\Services\Domain\Document\Import;

use HiEvents\Services\Domain\Document\DocumentBlocks;
use HiEvents\Services\Domain\Document\Import\ImportedDocumentBuilder;
use Tests\TestCase;

class ImportedDocumentBuilderTest extends TestCase
{
    private function block(string $type, string $text = '', array $items = [], bool $required = false, string $signer = 'participant'): array
    {
        return compact('type', 'text', 'items', 'required', 'signer');
    }

    public function testBuildsEachKindOfBlock(): void
    {
        $document = (new ImportedDocumentBuilder())->build([
            'title' => '  Décharge   de responsabilité ',
            'for_minors' => false,
            'blocks' => [
                $this->block('title', 'Décharge'),
                $this->block('paragraph', "Je, {participant_name}, **accepte** les *risques*.\nLigne deux"),
                $this->block('clause', '3. Je suis en bonne santé.'),
                $this->block('list', items: ['Casque', '  ', 'Gants']),
                $this->block('field', 'Téléphone :', required: true),
                $this->block('checkbox', "J'accepte", required: true),
                $this->block('signature', signer: 'guardian'),
                $this->block('separator'),
            ],
        ], 'fichier');

        $this->assertSame('Décharge de responsabilité', $document->title);
        $this->assertSame('ALL', $document->audience);
        $this->assertSame(
            ['title', 'paragraph', 'clause', 'list', 'field', 'checkbox', 'signature', 'separator'],
            array_column($document->blocks, 'type'),
        );

        $this->assertSame([
            ['type' => 'text', 'text' => 'Je, '],
            ['type' => 'field', 'attrs' => ['key' => 'participant_name']],
            ['type' => 'text', 'text' => ', '],
            ['type' => 'text', 'text' => 'accepte', 'marks' => [['type' => 'bold']]],
            ['type' => 'text', 'text' => ' les '],
            ['type' => 'text', 'text' => 'risques', 'marks' => [['type' => 'italic']]],
            ['type' => 'text', 'text' => '.'],
            ['type' => 'hardBreak'],
            ['type' => 'text', 'text' => 'Ligne deux'],
        ], $document->blocks[1]['content']['content'][0]['content']);

        $this->assertSame('Je suis en bonne santé.', $document->blocks[2]['content']['content'][0]['content'][0]['text']);
        $this->assertCount(2, $document->blocks[3]['content']['content'][0]['content']);
        $this->assertSame('Téléphone', $document->blocks[4]['label']);
        $this->assertTrue($document->blocks[4]['required']);
        $this->assertSame('guardian', $document->blocks[6]['signer']);

        // What the editor saves accepts it as is.
        $this->assertSame($document->blocks, DocumentBlocks::normalize($document->blocks));
    }

    public function testDropsEmptyAndUnknownBlocksAndFallsBackOnTheFileName(): void
    {
        $document = (new ImportedDocumentBuilder())->build([
            'title' => '',
            'for_minors' => true,
            'blocks' => [
                $this->block('paragraph', '   '),
                $this->block('image', 'logo'),
                'not a block',
                $this->block('list'),
                $this->block('clause', 'Une clause'),
            ],
        ], 'Consentement parental');

        $this->assertSame('Consentement parental', $document->title);
        $this->assertSame('MINORS', $document->audience);
        $this->assertSame(['clause'], array_column($document->blocks, 'type'));
    }

    public function testKeepsUnknownBracesAndLoneAsterisksAsText(): void
    {
        $document = (new ImportedDocumentBuilder())->build([
            'blocks' => [$this->block('paragraph', '{password} 5 * 3 = 15 *')],
        ], 'x');

        $this->assertSame(
            [['type' => 'text', 'text' => '{password} 5 * 3 = 15 *']],
            $document->blocks[0]['content']['content'][0]['content'],
        );
    }

    public function testKeepsAtMostTheEditorsNumberOfBlocks(): void
    {
        $document = (new ImportedDocumentBuilder())->build([
            'blocks' => array_fill(0, DocumentBlocks::MAX_BLOCKS + 10, $this->block('separator')),
        ], 'x');

        $this->assertCount(DocumentBlocks::MAX_BLOCKS, $document->blocks);
    }
}
