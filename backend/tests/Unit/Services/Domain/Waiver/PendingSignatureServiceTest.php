<?php

namespace Tests\Unit\Services\Domain\Waiver;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\WaiverDomainObject;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionAnswerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentSigningService;
use HiEvents\Services\Domain\Waiver\PendingSignatureService;
use HiEvents\Services\Domain\Waiver\WaiverService;
use Illuminate\Validation\ValidationException;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class PendingSignatureServiceTest extends TestCase
{
    private AttendeeRepositoryInterface|MockInterface $attendeeRepository;
    private WaiverService|MockInterface $waiverService;
    private PendingSignatureService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->attendeeRepository = Mockery::mock(AttendeeRepositoryInterface::class);
        $this->waiverService = Mockery::mock(WaiverService::class);
        $this->waiverService->shouldReceive('isMinorOnEventDay')->andReturnFalse()->byDefault();

        $documentSignatures = Mockery::mock(DocumentSignatureRepositoryInterface::class);
        $documentSignatures->shouldReceive('findWhere')->andReturn(collect());

        $questions = Mockery::mock(QuestionRepositoryInterface::class);
        $questions->shouldReceive('findFirstWhere')->andReturnNull();

        $this->service = new PendingSignatureService(
            waiverService: $this->waiverService,
            documentSigningService: Mockery::mock(DocumentSigningService::class),
            attendeeRepository: $this->attendeeRepository,
            documentSignatureRepository: $documentSignatures,
            questionRepository: $questions,
            questionAnswerRepository: Mockery::mock(QuestionAnswerRepositoryInterface::class),
        );
    }

    public function test_an_unsigned_waiver_is_pending(): void
    {
        $this->assertTrue($this->service->hasPending($this->attendee(), $this->settings()));
        $this->assertFalse($this->service->hasPending($this->attendee(signedAt: '2026-11-09 10:00:00'), $this->settings()));
        $this->assertFalse($this->service->hasPending($this->attendee(), $this->settings('')));
    }

    public function test_signing_needs_the_waiver_accepted_and_a_name(): void
    {
        $this->attendeeRepository->shouldNotReceive('updateFromArray');

        try {
            $this->service->sign($this->attendee(), $this->event(), $this->settings(), ['waiver' => ['accepted' => false]], '127.0.0.1');
            $this->fail('Expected ValidationException');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('waiver.accepted', $e->errors());
            $this->assertArrayHasKey('waiver.signed_name', $e->errors());
        }
    }

    public function test_a_minor_needs_a_parent_or_guardian(): void
    {
        $this->waiverService->shouldReceive('isMinorOnEventDay')->andReturnTrue();

        try {
            $this->service->sign($this->attendee(), $this->event(), $this->settings(), ['waiver' => ['accepted' => true, 'signed_name' => 'Léa Tremblay']], null);
            $this->fail('Expected ValidationException');
        } catch (ValidationException $e) {
            $this->assertSame(['waiver.guardian_name'], array_keys($e->errors()));
        }
    }

    public function test_the_participant_signature_is_recorded(): void
    {
        $this->waiverService->shouldReceive('currentVersion')->andReturn((new WaiverDomainObject())->setId(7));

        $this->attendeeRepository->shouldReceive('updateFromArray')
            ->once()
            ->withArgs(fn(int $id, array $attributes) => $id === 12
                && $attributes[AttendeeDomainObjectAbstract::WAIVER_ID] === 7
                && $attributes[AttendeeDomainObjectAbstract::WAIVER_SIGNED_NAME] === 'Léa Tremblay'
                && $attributes[AttendeeDomainObjectAbstract::WAIVER_GUARDIAN_NAME] === null
                && $attributes[AttendeeDomainObjectAbstract::WAIVER_IP_ADDRESS] === '127.0.0.1'
                && $attributes[AttendeeDomainObjectAbstract::WAIVER_SIGNED_AT] !== null)
            ->andReturn($this->attendee());

        $this->service->sign($this->attendee(), $this->event(), $this->settings(), [
            'waiver' => ['accepted' => true, 'signed_name' => ' Léa Tremblay '],
        ], '127.0.0.1');
    }

    private function attendee(?string $signedAt = null): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())->setId(12)->setEventId(3)->setWaiverSignedAt($signedAt);
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())->setId(3);
    }

    private function settings(string $waiverText = '<p>Je reconnais les risques.</p>'): EventSettingDomainObject
    {
        return (new EventSettingDomainObject())->setWaiverText($waiverText);
    }
}
