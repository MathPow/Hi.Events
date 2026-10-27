<?php

namespace Tests\Unit\Validators\Rules;

use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Repository\Interfaces\WaiverRepositoryInterface;
use HiEvents\Services\Domain\Waiver\WaiverService;
use HiEvents\Validators\Rules\ProductWaiverRule;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Mockery as m;
use Tests\TestCase;

class ProductWaiverRuleTest extends TestCase
{
    private const TICKET_ID = 1;
    private const MERCH_ID = 2;
    private const DATE_OF_BIRTH_QUESTION_ID = 30;

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    private function errors(array $products): array
    {
        $rule = new ProductWaiverRule(
            products: new Collection([
                (new ProductDomainObject())->setId(self::TICKET_ID)->setProductType(ProductType::TICKET->name),
                (new ProductDomainObject())->setId(self::MERCH_ID)->setProductType(ProductType::GENERAL->name),
            ]),
            event: (new EventDomainObject())->setStartDate('2027-06-12 12:00:00')->setTimezone('America/Montreal'),
            dateOfBirthQuestionId: self::DATE_OF_BIRTH_QUESTION_ID,
            waiverService: new WaiverService(m::mock(WaiverRepositoryInterface::class), m::mock(DatabaseManager::class)),
        );

        $validator = Validator::make(['products' => $products], ['products' => [$rule]]);
        $validator->passes();

        return $validator->errors()->toArray();
    }

    private function attendee(array $waiver, ?string $dateOfBirth = null, int $productId = self::TICKET_ID): array
    {
        return [
            'product_id' => $productId,
            'waiver' => $waiver,
            'questions' => $dateOfBirth === null ? [] : [[
                'question_id' => self::DATE_OF_BIRTH_QUESTION_ID,
                'response' => ['answer' => $dateOfBirth],
            ]],
        ];
    }

    public function testAnAdultSignsWithTheirName(): void
    {
        $this->assertSame([], $this->errors([$this->attendee(['accepted' => true, 'signed_name' => 'Léa Doe'], '1990-01-01')]));
    }

    public function testEachTicketAttendeeMustAcceptAndSign(): void
    {
        $errors = $this->errors([
            $this->attendee(['accepted' => true, 'signed_name' => 'Léa Doe']),
            $this->attendee(['accepted' => false, 'signed_name' => '  ']),
        ]);

        $this->assertArrayNotHasKey('products.0.waiver.accepted', $errors);
        $this->assertArrayHasKey('products.1.waiver.accepted', $errors);
        $this->assertArrayHasKey('products.1.waiver.signed_name', $errors);
    }

    public function testAMinorNeedsAParentOrGuardian(): void
    {
        $errors = $this->errors([$this->attendee(['accepted' => true, 'signed_name' => 'Léo Doe'], '2012-03-04')]);

        $this->assertArrayHasKey('products.0.waiver.guardian_name', $errors);
        $this->assertSame([], $this->errors([
            $this->attendee(['accepted' => true, 'signed_name' => 'Léo Doe', 'guardian_name' => 'John Doe'], '2012-03-04'),
        ]));
    }

    public function testMerchandiseNeedsNoSignature(): void
    {
        $this->assertSame([], $this->errors([$this->attendee([], null, self::MERCH_ID)]));
    }
}
