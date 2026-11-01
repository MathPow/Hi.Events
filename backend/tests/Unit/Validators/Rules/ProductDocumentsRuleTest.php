<?php

namespace Tests\Unit\Validators\Rules;

use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Repository\Interfaces\WaiverRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentBlocks;
use HiEvents\Services\Domain\Document\DocumentSigningService;
use HiEvents\Services\Domain\Waiver\WaiverService;
use HiEvents\Validators\Rules\ProductDocumentsRule;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Mockery as m;
use Tests\TestCase;

class ProductDocumentsRuleTest extends TestCase
{
    private const TICKET_ID = 1;
    private const MERCH_ID = 2;
    private const WAIVER_ID = 10;
    private const MINORS_ID = 11;
    private const PRINT_ID = 12;

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    private function documents(): Collection
    {
        return new Collection([
            (new OrganizerDocumentDomainObject())->setId(self::WAIVER_ID)->setTitle('Décharge')
                ->setSigningMode('ONLINE')->setAudience('ALL')
                ->setBlocks(DocumentBlocks::normalize([
                    ['id' => 'allergies', 'type' => 'field', 'label' => 'Allergies', 'required' => true],
                    ['id' => 'photos', 'type' => 'checkbox', 'required' => false],
                    ['id' => 'consent', 'type' => 'checkbox', 'required' => true],
                    ['id' => 'me', 'type' => 'signature', 'signer' => 'participant'],
                    ['id' => 'parent', 'type' => 'signature', 'signer' => 'guardian'],
                ])),
            (new OrganizerDocumentDomainObject())->setId(self::MINORS_ID)->setTitle('Attestation parentale')
                ->setSigningMode('ONLINE')->setAudience('MINORS')
                ->setBlocks(DocumentBlocks::normalize([
                    ['id' => 'parent', 'type' => 'signature', 'signer' => 'guardian'],
                ])),
            (new OrganizerDocumentDomainObject())->setId(self::PRINT_ID)->setTitle('Règlements')
                ->setSigningMode('PRINT')->setAudience('ALL')
                ->setBlocks(DocumentBlocks::normalize([])),
        ]);
    }

    private function errors(array $products, ?int $dateOfBirthQuestionId = null): array
    {
        $rule = new ProductDocumentsRule(
            documents: $this->documents(),
            products: new Collection([
                (new ProductDomainObject())->setId(self::TICKET_ID)->setProductType(ProductType::TICKET->name),
                (new ProductDomainObject())->setId(self::MERCH_ID)->setProductType(ProductType::GENERAL->name),
            ]),
            event: (new EventDomainObject())->setStartDate('2027-06-12 12:00:00')->setTimezone('America/Montreal'),
            dateOfBirthQuestionId: $dateOfBirthQuestionId,
            signingService: new DocumentSigningService(
                new WaiverService(m::mock(WaiverRepositoryInterface::class), m::mock(DatabaseManager::class)),
                m::mock(DocumentSignatureRepositoryInterface::class),
            ),
        );

        $validator = Validator::make(['products' => $products], ['products' => [$rule]]);
        $validator->passes();

        return $validator->errors()->toArray();
    }

    private function signedWaiver(array $answers = []): array
    {
        return [
            'document_id' => self::WAIVER_ID,
            'accepted' => true,
            'answers' => [...['allergies' => 'Aucune', 'consent' => true, 'me' => 'Marie Tremblay'], ...$answers],
        ];
    }

    public function testAnAdultSignsTheDocumentsForEveryone(): void
    {
        $this->assertSame([], $this->errors([[
            'product_id' => self::TICKET_ID,
            'document_birth_date' => '1990-04-02',
            'documents' => [$this->signedWaiver()],
        ]]));
    }

    public function testMissingAnswersLandOnTheirOwnFields(): void
    {
        $errors = $this->errors([[
            'product_id' => self::TICKET_ID,
            'document_birth_date' => '1990-04-02',
            'documents' => [[
                'document_id' => self::WAIVER_ID,
                'accepted' => false,
                'answers' => ['allergies' => ' ', 'me' => ''],
            ]],
        ]]);

        $this->assertSame([
            'products.0.documents.0.accepted',
            'products.0.documents.0.answers.allergies',
            'products.0.documents.0.answers.consent',
            'products.0.documents.0.answers.me',
        ], array_keys($errors));
    }

    public function testAMinorAlsoNeedsTheParentAndTheMinorsOnlyDocument(): void
    {
        $errors = $this->errors([[
            'product_id' => self::TICKET_ID,
            'document_birth_date' => '2012-01-01',
            'documents' => [$this->signedWaiver()],
        ]]);

        $this->assertSame([
            'products.0.documents.0.answers.parent',
            'products.0.documents',
        ], array_keys($errors));

        $this->assertSame([], $this->errors([[
            'product_id' => self::TICKET_ID,
            'document_birth_date' => '2012-01-01',
            'documents' => [
                $this->signedWaiver(['parent' => 'Julie Tremblay']),
                ['document_id' => self::MINORS_ID, 'accepted' => true, 'answers' => ['parent' => 'Julie Tremblay']],
            ],
        ]]));
    }

    public function testTheDateOfBirthIsAskedWithoutTheParticipantForm(): void
    {
        $this->assertSame(['products.0.document_birth_date'], array_keys($this->errors([[
            'product_id' => self::TICKET_ID,
            'documents' => [$this->signedWaiver()],
        ]])));

        $this->assertSame(['products.0.document_birth_date'], array_keys($this->errors([[
            'product_id' => self::TICKET_ID,
            'document_birth_date' => '2999-01-01',
            'documents' => [$this->signedWaiver()],
        ]])));
    }

    public function testTheParticipantFormDateOfBirthIsUsedWhenThereIsOne(): void
    {
        $errors = $this->errors([[
            'product_id' => self::TICKET_ID,
            'questions' => [['question_id' => 30, 'response' => ['answer' => '2012-01-01']]],
            'documents' => [$this->signedWaiver(['parent' => 'Julie Tremblay'])],
        ]], dateOfBirthQuestionId: 30);

        $this->assertSame(['products.0.documents'], array_keys($errors));
    }

    public function testAnAdultSignsAGuardianOnlyDocumentThemself(): void
    {
        $rule = new ProductDocumentsRule(
            documents: new Collection([
                (new OrganizerDocumentDomainObject())->setId(self::WAIVER_ID)->setTitle('Autorisation')
                    ->setSigningMode('ONLINE')->setAudience('ALL')
                    ->setBlocks(DocumentBlocks::normalize([['id' => 'parent', 'type' => 'signature', 'signer' => 'guardian']])),
            ]),
            products: new Collection([(new ProductDomainObject())->setId(self::TICKET_ID)->setProductType(ProductType::TICKET->name)]),
            event: (new EventDomainObject())->setStartDate('2027-06-12 12:00:00')->setTimezone('America/Montreal'),
            dateOfBirthQuestionId: null,
            signingService: new DocumentSigningService(
                new WaiverService(m::mock(WaiverRepositoryInterface::class), m::mock(DatabaseManager::class)),
                m::mock(DocumentSignatureRepositoryInterface::class),
            ),
        );

        $validator = Validator::make(['products' => [[
            'product_id' => self::TICKET_ID,
            'document_birth_date' => '1990-04-02',
            'documents' => [['document_id' => self::WAIVER_ID, 'accepted' => true, 'answers' => []]],
        ]]], ['products' => [$rule]]);
        $validator->passes();

        $this->assertSame(['products.0.documents.0.answers.' . DocumentBlocks::IMPLICIT_SIGNATURE], array_keys($validator->errors()->toArray()));
    }

    public function testMerchDoesNotSign(): void
    {
        $this->assertSame([], $this->errors([['product_id' => self::MERCH_ID]]));
    }
}
