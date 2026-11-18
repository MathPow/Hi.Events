<?php

namespace Tests\Unit\Services\Domain\Question;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\QuestionPresetKey;
use HiEvents\DomainObjects\Enums\QuestionTypeEnum;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\Repository\Interfaces\QuestionAnswerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Domain\Question\ParticipantDetailsService;
use Illuminate\Validation\ValidationException;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class ParticipantDetailsServiceTest extends TestCase
{
    private QuestionRepositoryInterface|MockInterface $questionRepository;
    private QuestionAnswerRepositoryInterface|MockInterface $answerRepository;
    private ParticipantDetailsService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->questionRepository = Mockery::mock(QuestionRepositoryInterface::class);
        $this->answerRepository = Mockery::mock(QuestionAnswerRepositoryInterface::class);

        $this->service = new ParticipantDetailsService($this->questionRepository, $this->answerRepository);
    }

    public function test_the_answers_are_emptied_then_deleted(): void
    {
        $this->questionRepository->shouldReceive('findWhere')->once()->andReturn(collect([$this->dateOfBirth(), $this->emergencyContact()]));
        $where = ['attendee_id' => 10, ['question_id', 'in', [21, 22]]];
        $this->answerRepository->shouldReceive('updateWhere')->once()->with(['answer' => null], $where)->ordered();
        $this->answerRepository->shouldReceive('deleteWhere')->once()->with($where)->ordered();

        $this->service->eraseAnswers($this->attendee());
    }

    public function test_nothing_is_erased_without_a_participant_form(): void
    {
        $this->questionRepository->shouldReceive('findWhere')->andReturn(collect());
        $this->answerRepository->shouldNotReceive('updateWhere');
        $this->answerRepository->shouldNotReceive('deleteWhere');

        $this->service->eraseAnswers($this->attendee());
    }

    public function test_a_required_question_must_be_answered(): void
    {
        $this->answerRepository->shouldNotReceive('create');

        try {
            $this->service->saveAnswers($this->attendee(), collect([$this->dateOfBirth(), $this->emergencyContact()]), [
                'questions' => [
                    ['question_id' => 21, 'response' => ['answer' => '']],
                ],
            ]);
            $this->fail('Expected ValidationException');
        } catch (ValidationException $exception) {
            $this->assertSame(['questions.0.response.answer', 'questions.1.response.answer'], array_keys($exception->errors()));
        }
    }

    public function test_the_answers_replace_the_previous_ones(): void
    {
        $this->questionRepository->shouldReceive('findWhere')->andReturn(collect([$this->dateOfBirth(), $this->emergencyContact(), $this->health()]));
        $this->answerRepository->shouldReceive('updateWhere')->once()->ordered();
        $this->answerRepository->shouldReceive('deleteWhere')->once()->ordered();
        $this->answerRepository->shouldReceive('create')->once()->with([
            'question_id' => 21,
            'answer' => '1990-05-01',
            'order_id' => 5,
            'product_id' => 3,
            'attendee_id' => 10,
        ])->ordered();
        $this->answerRepository->shouldReceive('create')->once()->with([
            'question_id' => 22,
            'answer' => 'Paul Tremblay',
            'order_id' => 5,
            'product_id' => 3,
            'attendee_id' => 10,
        ])->ordered();

        // The optional health question left empty is not stored.
        $this->service->saveAnswers($this->attendee(), collect([$this->dateOfBirth(), $this->emergencyContact(), $this->health()]), [
            'questions' => [
                ['question_id' => 21, 'response' => ['answer' => '1990-05-01']],
                ['question_id' => 22, 'response' => ['answer' => ' Paul Tremblay ']],
                ['question_id' => 23, 'response' => ['answer' => '']],
            ],
        ]);
    }

    public function test_an_answer_longer_than_allowed_is_refused(): void
    {
        try {
            $this->service->saveAnswers($this->attendee(), collect([$this->emergencyContact()]), [
                'questions' => [['question_id' => 22, 'response' => ['answer' => str_repeat('a', 256)]]],
            ]);
            $this->fail('Expected ValidationException');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('questions.0.response.answer', $exception->errors());
        }
    }

    public function test_the_date_of_birth_is_read_from_the_answers(): void
    {
        $questions = collect([$this->emergencyContact(), $this->dateOfBirth()]);

        $this->assertSame('2012-03-04', $this->service->dateOfBirth($questions, [
            'questions' => [['question_id' => 21, 'response' => ['answer' => '2012-03-04']]],
        ]));
        $this->assertNull($this->service->dateOfBirth(collect([$this->emergencyContact()]), [
            'questions' => [['question_id' => 21, 'response' => ['answer' => '2012-03-04']]],
        ]));
    }

    private function attendee(): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())->setId(10)->setEventId(1)->setOrderId(5)->setProductId(3);
    }

    private function dateOfBirth(): QuestionDomainObject
    {
        return $this->question(21, QuestionTypeEnum::DATE, true, QuestionPresetKey::DATE_OF_BIRTH);
    }

    private function emergencyContact(): QuestionDomainObject
    {
        return $this->question(22, QuestionTypeEnum::SINGLE_LINE_TEXT, true, QuestionPresetKey::EMERGENCY_CONTACT_NAME);
    }

    private function health(): QuestionDomainObject
    {
        return $this->question(23, QuestionTypeEnum::MULTI_LINE_TEXT, false, QuestionPresetKey::HEALTH_NOTES);
    }

    private function question(int $id, QuestionTypeEnum $type, bool $required, QuestionPresetKey $key): QuestionDomainObject
    {
        return (new QuestionDomainObject())
            ->setId($id)
            ->setType($type->name)
            ->setRequired($required)
            ->setPresetKey($key->value)
            ->setIsSensitive(true);
    }
}
