<?php

namespace Tests\Unit\Services\Application\Handlers\Question;

use HiEvents\DomainObjects\Enums\QuestionPresetKey;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\Exceptions\NoTicketProductsException;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Application\Handlers\Question\AddParticipantFormHandler;
use HiEvents\Services\Domain\Question\CreateQuestionService;
use Illuminate\Support\Collection;
use Mockery as m;
use Tests\TestCase;

class AddParticipantFormHandlerTest extends TestCase
{
    private QuestionRepositoryInterface $questionRepository;
    private ProductRepositoryInterface $productRepository;
    private CreateQuestionService $createQuestionService;
    private AddParticipantFormHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->questionRepository = m::mock(QuestionRepositoryInterface::class);
        $this->productRepository = m::mock(ProductRepositoryInterface::class);
        $this->createQuestionService = m::mock(CreateQuestionService::class);

        $this->handler = new AddParticipantFormHandler(
            questionRepository: $this->questionRepository,
            productRepository: $this->productRepository,
            createQuestionService: $this->createQuestionService,
        );
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    private function givenTickets(array $ids): void
    {
        $this->productRepository->shouldReceive('findWhere')
            ->once()
            ->with(['event_id' => 5, 'product_type' => 'TICKET'])
            ->andReturn(new Collection(array_map(fn($id) => (new ProductDomainObject())->setId($id), $ids)));
    }

    private function givenExistingPresets(array $keys): void
    {
        $this->questionRepository->shouldReceive('findWhereIn')
            ->once()
            ->with('preset_key', QuestionPresetKey::valuesArray(), ['event_id' => 5])
            ->andReturn(new Collection(array_map(fn($key) => (new QuestionDomainObject())->setPresetKey($key), $keys)));
    }

    public function testAddsTheFourSensitiveQuestionsToEveryTicket(): void
    {
        $this->givenTickets([3, 4]);
        $this->givenExistingPresets([]);

        $created = [];
        $this->createQuestionService->shouldReceive('createQuestion')
            ->times(4)
            ->with(m::type(QuestionDomainObject::class), [3, 4])
            ->andReturnUsing(function (QuestionDomainObject $question) use (&$created) {
                $created[] = $question;
                return $question;
            });

        $questions = $this->handler->handle(5);

        $this->assertCount(4, $questions);
        $this->assertSame(QuestionPresetKey::valuesArray(), array_map(fn($q) => $q->getPresetKey(), $created));
        foreach ($created as $question) {
            $this->assertTrue($question->getIsSensitive());
            $this->assertSame(5, $question->getEventId());
            $this->assertSame('PRODUCT', $question->getBelongsTo());
        }
        $this->assertSame('DATE', $created[0]->getType());
        $this->assertFalse($created[3]->getRequired());
    }

    public function testLeavesTheQuestionsAlreadyAdded(): void
    {
        $this->givenTickets([3]);
        $this->givenExistingPresets([QuestionPresetKey::DATE_OF_BIRTH->value, QuestionPresetKey::HEALTH_NOTES->value]);

        $this->createQuestionService->shouldReceive('createQuestion')
            ->twice()
            ->andReturnUsing(fn(QuestionDomainObject $question) => $question);

        $keys = $this->handler->handle(5)->map(fn($q) => $q->getPresetKey())->all();

        $this->assertSame([
            QuestionPresetKey::EMERGENCY_CONTACT_NAME->value,
            QuestionPresetKey::EMERGENCY_CONTACT_PHONE->value,
        ], $keys);
    }

    public function testNeedsATicket(): void
    {
        $this->givenTickets([]);
        $this->createQuestionService->shouldNotReceive('createQuestion');

        $this->expectException(NoTicketProductsException::class);

        $this->handler->handle(5);
    }
}
