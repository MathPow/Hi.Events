<?php

namespace Tests\Unit\Services\Domain\Document;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\DocumentSignatureDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerDocumentRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentSigningService;
use HiEvents\Services\Domain\Document\OrderDocumentCopyService;
use Illuminate\Support\Collection;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class OrderDocumentCopyServiceTest extends TestCase
{
    private OrganizerDocumentRepositoryInterface|MockInterface $documents;
    private DocumentSignatureRepositoryInterface|MockInterface $copies;
    private DocumentSigningService|MockInterface $signing;
    private OrderDocumentCopyService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->documents = Mockery::mock(OrganizerDocumentRepositoryInterface::class);
        $this->copies = Mockery::mock(DocumentSignatureRepositoryInterface::class);
        $this->signing = Mockery::mock(DocumentSigningService::class);

        $events = Mockery::mock(EventRepositoryInterface::class);
        $events->shouldReceive('findById')->with(1)->andReturn((new EventDomainObject())->setId(1)->setOrganizerId(2));
        $organizers = Mockery::mock(OrganizerRepositoryInterface::class);
        $organizers->shouldReceive('findById')->with(2)->andReturn((new OrganizerDomainObject())->setId(2)->setName('Club Dehors'));

        $this->service = new OrderDocumentCopyService(
            $this->documents,
            $this->copies,
            Mockery::mock(AttendeeRepositoryInterface::class),
            $events,
            $organizers,
            Mockery::mock(QuestionRepositoryInterface::class),
            $this->signing,
        );
    }

    public function test_the_unsigned_copies_are_made_again_for_the_holder_to_sign(): void
    {
        $this->copies->shouldReceive('deleteWhere')->once()->with(['attendee_id' => 10, ['signed_at', 'null', null]])->ordered();
        $this->copies->shouldReceive('findWhere')->andReturn(collect([
            (new DocumentSignatureDomainObject())->setId(50)->setOrganizerDocumentId(31)->setSignedAt('2026-11-10 10:00:00'),
        ]));
        $this->documents->shouldReceive('findForEvent')->with(1)->andReturn(collect([
            (new OrganizerDocumentDomainObject())->setId(31),
            (new OrganizerDocumentDomainObject())->setId(32),
        ]));

        // The document already signed by the holder is left as it is.
        $this->signing->shouldReceive('createCopies')
            ->once()
            ->withArgs(fn(Collection $documents, AttendeeDomainObject $attendee, EventDomainObject $event, string $organizerName, ?string $dateOfBirth, array $entries, ?string $ipAddress, string $locale, bool $signNow) => $documents->map(fn($document) => $document->getId())->all() === [32]
                && $attendee->getId() === 10
                && $organizerName === 'Club Dehors'
                && $dateOfBirth === '2012-03-04'
                && $entries === []
                && $locale === 'fr'
                && $signNow === false)
            ->ordered();

        $this->service->replaceUnsignedForAttendee($this->attendee(), '2012-03-04', 'fr');
    }

    public function test_nothing_is_made_when_the_event_has_no_document(): void
    {
        $this->copies->shouldReceive('deleteWhere')->once();
        $this->copies->shouldReceive('findWhere')->andReturn(collect());
        $this->documents->shouldReceive('findForEvent')->andReturn(collect());
        $this->signing->shouldNotReceive('createCopies');

        $this->service->replaceUnsignedForAttendee($this->attendee(), null, 'fr');
    }

    public function test_all_the_copies_of_an_attendee_are_deleted(): void
    {
        $this->copies->shouldReceive('deleteWhere')->once()->with(['attendee_id' => 10]);

        $this->service->deleteForAttendee(10);
    }

    private function attendee(): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())->setId(10)->setEventId(1)->setOrderId(5);
    }
}
