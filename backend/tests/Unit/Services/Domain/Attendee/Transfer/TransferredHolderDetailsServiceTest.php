<?php

namespace Tests\Unit\Services\Domain\Attendee\Transfer;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\AttendeeTransferDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\QuestionDomainObject;
use HiEvents\Repository\Interfaces\AttendeeTransferRepositoryInterface;
use HiEvents\Services\Domain\Attendee\Transfer\TransferredHolderDetailsService;
use HiEvents\Services\Domain\Document\OrderDocumentCopyService;
use HiEvents\Services\Domain\Question\ParticipantDetailsService;
use Illuminate\Database\DatabaseManager;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class TransferredHolderDetailsServiceTest extends TestCase
{
    private AttendeeTransferRepositoryInterface|MockInterface $transfers;
    private ParticipantDetailsService|MockInterface $participantDetails;
    private OrderDocumentCopyService|MockInterface $documentCopies;
    private TransferredHolderDetailsService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->transfers = Mockery::mock(AttendeeTransferRepositoryInterface::class);
        $this->participantDetails = Mockery::mock(ParticipantDetailsService::class);
        $this->participantDetails->shouldReceive('questionsFor')->andReturn(collect([(new QuestionDomainObject())->setId(21)]))->byDefault();
        $this->documentCopies = Mockery::mock(OrderDocumentCopyService::class);

        $database = Mockery::mock(DatabaseManager::class);
        $database->shouldReceive('transaction')->andReturnUsing(fn(callable $callback) => $callback());

        $this->service = new TransferredHolderDetailsService($this->transfers, $this->participantDetails, $this->documentCopies, $database);
    }

    public function test_the_new_holder_is_asked_for_their_details(): void
    {
        $this->transfers->shouldReceive('findWhere')->andReturn(collect([$this->transfer(1)]));

        $this->assertSame([21], $this->service->pendingQuestions($this->attendee(), $this->event())
            ->map(fn(QuestionDomainObject $question) => $question->getId())->all());
    }

    public function test_a_ticket_that_was_not_transferred_asks_nothing(): void
    {
        $this->transfers->shouldReceive('findWhere')->andReturn(collect());

        $this->assertTrue($this->service->pendingQuestions($this->attendee(), $this->event())->isEmpty());
    }

    public function test_details_already_given_are_not_asked_again(): void
    {
        $this->transfers->shouldReceive('findWhere')->andReturn(collect([
            $this->transfer(1),
            $this->transfer(2, completedAt: '2026-11-10 10:00:00'),
        ]));

        $this->assertTrue($this->service->pendingQuestions($this->attendee(), $this->event())->isEmpty());
    }

    public function test_nothing_is_asked_once_the_event_has_started(): void
    {
        $this->transfers->shouldNotReceive('findWhere');

        $this->assertTrue($this->service->pendingQuestions($this->attendee(), $this->event('2020-01-01 10:00:00'))->isEmpty());
    }

    public function test_the_details_are_saved_and_the_documents_follow_the_date_of_birth(): void
    {
        $this->transfers->shouldReceive('findWhere')->andReturn(collect([$this->transfer(7)]));
        $input = ['questions' => [['question_id' => 21, 'response' => ['answer' => '2012-03-04']]]];

        $this->participantDetails->shouldReceive('saveAnswers')->once()->withArgs(fn($attendee, $questions, $given) => $given === $input)->ordered();
        $this->participantDetails->shouldReceive('dateOfBirth')->andReturn('2012-03-04');
        $this->documentCopies->shouldReceive('replaceUnsignedForAttendee')
            ->once()
            ->withArgs(fn(AttendeeDomainObject $attendee, ?string $dateOfBirth, string $locale) => $dateOfBirth === '2012-03-04' && $locale === 'fr')
            ->ordered();
        $this->transfers->shouldReceive('updateFromArray')
            ->once()
            ->withArgs(fn(int $id, array $attributes) => $id === 7 && isset($attributes['details_completed_at']));

        $this->service->complete($this->attendee(), $this->event(), $input, 'fr');
    }

    public function test_nothing_is_saved_when_nothing_is_asked(): void
    {
        $this->transfers->shouldReceive('findWhere')->andReturn(collect());
        $this->participantDetails->shouldNotReceive('saveAnswers');
        $this->documentCopies->shouldNotReceive('replaceUnsignedForAttendee');

        $this->service->complete($this->attendee(), $this->event(), ['questions' => []], 'fr');
    }

    private function attendee(): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())->setId(10)->setEventId(1)->setProductId(3)->setStatus('ACTIVE');
    }

    private function event(string $startDate = '2099-06-01 12:00:00'): EventDomainObject
    {
        return (new EventDomainObject())->setId(1)->setStartDate($startDate);
    }

    private function transfer(int $id, ?string $completedAt = null): AttendeeTransferDomainObject
    {
        return (new AttendeeTransferDomainObject())->setId($id)->setAttendeeId(10)->setDetailsCompletedAt($completedAt);
    }
}
