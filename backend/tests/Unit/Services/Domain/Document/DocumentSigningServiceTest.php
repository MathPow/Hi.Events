<?php

namespace Tests\Unit\Services\Domain\Document;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\DocumentSignatureDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Repository\Interfaces\WaiverRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentBlocks;
use HiEvents\Services\Domain\Document\DocumentSigningService;
use HiEvents\Services\Domain\Waiver\WaiverService;
use Illuminate\Database\DatabaseManager;
use Mockery as m;
use Tests\TestCase;

class DocumentSigningServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    /**
     * @return array[] The copies created for an attendee born on $dateOfBirth.
     */
    public function testADocumentByAgeIsForTheParticipantsUnderItsAgeLimit(): void
    {
        $service = new DocumentSigningService(
            new WaiverService(m::mock(WaiverRepositoryInterface::class), m::mock(DatabaseManager::class)),
            m::mock(DocumentSignatureRepositoryInterface::class),
        );
        $event = (new EventDomainObject())->setStartDate('2027-06-12 12:00:00')->setTimezone('America/Montreal');
        $forAll = (new OrganizerDocumentDomainObject())->setAudience('ALL');
        $under16 = (new OrganizerDocumentDomainObject())->setAudience('MINORS')->setAudienceAge(16);
        $minors = (new OrganizerDocumentDomainObject())->setAudience('MINORS');

        $this->assertTrue($service->applies($forAll, '1990-01-01', $event));
        // 15 on the event day, then 16, then 17.
        $this->assertTrue($service->applies($under16, '2011-06-13', $event));
        $this->assertFalse($service->applies($under16, '2011-06-12', $event));
        $this->assertFalse($service->applies($under16, '2010-01-01', $event));
        // Without an age limit, the minors (under 18).
        $this->assertTrue($service->applies($minors, '2010-01-01', $event));
        $this->assertFalse($service->applies($minors, '2009-06-12', $event));
    }

    private function copies(?string $dateOfBirth, array $entries): array
    {
        $created = [];
        $repository = m::mock(DocumentSignatureRepositoryInterface::class);
        $repository->shouldReceive('create')->andReturnUsing(function (array $attributes) use (&$created) {
            $created[] = $attributes;
            return new DocumentSignatureDomainObject();
        });

        $service = new DocumentSigningService(
            new WaiverService(m::mock(WaiverRepositoryInterface::class), m::mock(DatabaseManager::class)),
            $repository,
        );

        $service->createCopies(
            documents: [
                (new OrganizerDocumentDomainObject())->setId(1)->setTitle('Décharge')->setSigningMode('ONLINE')->setAudience('ALL')
                    ->setBlocks(DocumentBlocks::normalize([
                        ['id' => 'allergies', 'type' => 'field', 'label' => 'Allergies', 'required' => false],
                        ['id' => 'me', 'type' => 'signature', 'signer' => 'participant'],
                        ['id' => 'parent', 'type' => 'signature', 'signer' => 'guardian'],
                    ])),
                (new OrganizerDocumentDomainObject())->setId(2)->setTitle('Attestation parentale')->setSigningMode('ONLINE')->setAudience('MINORS')
                    ->setBlocks(DocumentBlocks::normalize([['id' => 'parent', 'type' => 'signature', 'signer' => 'guardian']])),
                (new OrganizerDocumentDomainObject())->setId(3)->setTitle('Règlements')->setSigningMode('PRINT')->setAudience('ALL')
                    ->setBlocks(DocumentBlocks::normalize([])),
            ],
            attendee: (new AttendeeDomainObject())->setId(7)->setOrderId(9)->setFirstName('Léa')->setLastName('Tremblay'),
            event: (new EventDomainObject())->setId(4)->setTitle('Rando')->setStartDate('2027-06-12 12:00:00')->setTimezone('America/Montreal'),
            organizerName: 'Sulpace',
            dateOfBirth: $dateOfBirth,
            entries: $entries,
            ipAddress: '203.0.113.5',
            locale: 'fr',
        );

        return $created;
    }

    public function testAnAdultGetsTheDocumentsForEveryoneWithoutTheParentLine(): void
    {
        $copies = $this->copies('1990-04-02', [
            1 => ['document_id' => 1, 'accepted' => true, 'answers' => ['allergies' => ' Arachides ', 'me' => 'Léa Tremblay', 'parent' => 'Ignoré']],
        ]);

        $this->assertSame([1, 3], array_column($copies, 'organizer_document_id'));

        [$waiver, $print] = $copies;
        $this->assertSame(['allergies' => 'Arachides', 'me' => 'Léa Tremblay'], $waiver['answers']);
        $this->assertSame('Léa Tremblay', $waiver['signer_name']);
        $this->assertNull($waiver['guardian_name']);
        $this->assertSame('203.0.113.5', $waiver['ip_address']);
        $this->assertNotNull($waiver['signed_at']);
        $this->assertSame('Léa Tremblay', $waiver['auto_values']['participant_name']);
        $this->assertSame('2 avril 1990', $waiver['auto_values']['date_of_birth']);
        $this->assertSame('12 juin 2027', $waiver['auto_values']['event_date']);
        $this->assertFalse($waiver['auto_values']['is_minor']);

        $this->assertNull($print['answers']);
        $this->assertNull($print['signed_at']);
        $this->assertNull($print['ip_address']);
    }

    public function testAMinorAlsoGetsTheMinorsDocumentSignedByTheParent(): void
    {
        $copies = $this->copies('2012-05-05', [
            1 => ['document_id' => 1, 'accepted' => true, 'answers' => ['me' => 'Léa Tremblay', 'parent' => 'Julie Tremblay']],
            2 => ['document_id' => 2, 'accepted' => true, 'answers' => ['parent' => 'Julie Tremblay']],
        ]);

        $this->assertSame([1, 2, 3], array_column($copies, 'organizer_document_id'));
        $this->assertSame('Julie Tremblay', $copies[0]['guardian_name']);
        $this->assertSame(['parent' => 'Julie Tremblay'], $copies[1]['answers']);
        $this->assertNull($copies[1]['signer_name']);
        $this->assertTrue($copies[2]['auto_values']['is_minor']);
    }
}
