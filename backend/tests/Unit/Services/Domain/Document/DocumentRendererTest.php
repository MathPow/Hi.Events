<?php

namespace Tests\Unit\Services\Domain\Document;

use HiEvents\Services\Domain\Document\DocumentBlocks;
use HiEvents\Services\Domain\Document\DocumentRenderContext;
use HiEvents\Services\Domain\Document\DocumentRenderer;
use Tests\TestCase;

class DocumentRendererTest extends TestCase
{
    private function blocks(): array
    {
        return DocumentBlocks::normalize([
            ['id' => 't', 'type' => 'title', 'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Décharge <b>']]]]]],
            ['id' => 'p', 'type' => 'paragraph', 'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [
                ['type' => 'text', 'text' => 'Je, '],
                ['type' => 'field', 'attrs' => ['key' => 'participant_name']],
                ['type' => 'text', 'text' => ', accepte', 'marks' => [['type' => 'italic']]],
            ]]]]],
            ['id' => 'c1', 'type' => 'clause', 'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Un']]]]]],
            ['id' => 'c2', 'type' => 'clause', 'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Deux']]]]]],
            ['id' => 'f', 'type' => 'field', 'label' => 'Allergies', 'required' => true],
            ['id' => 'x', 'type' => 'checkbox', 'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Photos']]]]]],
            ['id' => 'sp', 'type' => 'signature', 'signer' => 'participant'],
            ['id' => 'sg', 'type' => 'signature', 'signer' => 'guardian'],
        ]);
    }

    public function testTheBlankDocumentLeavesLinesToFill(): void
    {
        $html = (new DocumentRenderer())->render($this->blocks(), new DocumentRenderContext());

        $this->assertStringContainsString('<h1>Décharge &lt;b&gt;</h1>', $html);
        $this->assertStringContainsString('<span class="blank">Participant name</span>', $html);
        $this->assertStringContainsString('<em>, accepte</em>', $html);
        $this->assertStringContainsString('1.</td>', $html);
        $this->assertStringContainsString('2.</td>', $html);
        $this->assertStringContainsString('&#9744;', $html);
        $this->assertStringContainsString('Name of parent or guardian', $html);
    }

    public function testASignedCopyShowsTheAnswersAndSkipsTheParentOfAnAdult(): void
    {
        $html = (new DocumentRenderer())->render($this->blocks(), new DocumentRenderContext(
            autoValues: ['participant_name' => 'Marie <Tremblay>'],
            answers: ['f' => 'Arachides', 'x' => true, 'sp' => 'Marie Tremblay'],
            showGuardian: false,
            signedOn: '31 octobre 2026',
        ));

        $this->assertStringContainsString('<span class="auto">Marie &lt;Tremblay&gt;</span>', $html);
        $this->assertStringContainsString('Arachides', $html);
        $this->assertStringContainsString('&#9745;', $html);
        $this->assertStringContainsString('<span class="typed">Marie Tremblay</span>', $html);
        $this->assertStringContainsString('31 octobre 2026', $html);
        $this->assertStringNotContainsString('Name of parent or guardian', $html);
    }

    public function testWithoutASignatureBlockTheParticipantSignsAtTheEnd(): void
    {
        $blocks = DocumentBlocks::normalize([['id' => 'h', 'type' => 'separator']]);

        $html = (new DocumentRenderer())->render($blocks, new DocumentRenderContext(
            answers: [DocumentBlocks::IMPLICIT_SIGNATURE => 'Jules Gagnon'],
            signedOn: '1 novembre 2026',
        ));

        $this->assertStringContainsString('<span class="typed">Jules Gagnon</span>', $html);
    }
}
