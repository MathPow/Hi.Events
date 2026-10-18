<?php

namespace Tests\Unit\Services\Domain\DonationReceipt;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\DonationReceiptDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\DonationReceiptRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\DonationReceipt\DonationBreakdownService;
use HiEvents\Services\Domain\DonationReceipt\DonationReceiptCreateService;
use Illuminate\Database\DatabaseManager;
use Mockery;
use Psr\Log\NullLogger;
use Tests\TestCase;

/**
 * Le numero d'organisme est saisi librement par l'organisateur: tant qu'un
 * superadmin n'a pas autorise le compte, aucun recu officiel ne part.
 */
class DonationReceiptCreateServiceAccountApprovalTest extends TestCase
{
    public function testNoReceiptIsIssuedForAnAccountThatWasNotApproved(): void
    {
        $donationReceiptRepository = Mockery::mock(DonationReceiptRepositoryInterface::class);
        $donationReceiptRepository->shouldNotReceive('findIssuedForOrder');
        $donationReceiptRepository->shouldNotReceive('create');

        $service = $this->service(receiptsAllowed: false, donationReceiptRepository: $donationReceiptRepository);

        $this->assertNull($service->createReceiptForOrder(10));
    }

    public function testAnApprovedAccountGoesOnToTheUsualChecks(): void
    {
        $existingReceipt = Mockery::mock(DonationReceiptDomainObject::class);

        $donationReceiptRepository = Mockery::mock(DonationReceiptRepositoryInterface::class);
        $donationReceiptRepository->shouldReceive('findIssuedForOrder')->once()->with(10)->andReturn($existingReceipt);
        $donationReceiptRepository->shouldNotReceive('create');

        $service = $this->service(receiptsAllowed: true, donationReceiptRepository: $donationReceiptRepository);

        $this->assertNull($service->createReceiptForOrder(10));
    }

    private function service(
        bool                               $receiptsAllowed,
        DonationReceiptRepositoryInterface $donationReceiptRepository,
    ): DonationReceiptCreateService
    {
        $settings = Mockery::mock(OrganizerSettingDomainObject::class);
        $settings->shouldReceive('getCharityRegistrationNumber')->andReturn('123456789RR0001');

        $organizer = Mockery::mock(OrganizerDomainObject::class);
        $organizer->shouldReceive('getOrganizerSettings')->andReturn($settings);
        $organizer->shouldReceive('getAccountId')->andReturn(1);

        $event = Mockery::mock(EventDomainObject::class);
        $event->shouldReceive('getOrganizer')->andReturn($organizer);

        $order = Mockery::mock(OrderDomainObject::class);
        $order->shouldReceive('getEvent')->andReturn($event);

        $orderRepository = Mockery::mock(OrderRepositoryInterface::class);
        $orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $orderRepository->shouldReceive('findById')->with(10)->andReturn($order);

        $accountRepository = Mockery::mock(AccountRepositoryInterface::class);
        $accountRepository->shouldReceive('findById')->with(1)->andReturn(
            (new AccountDomainObject())->setId(1)->setDonationReceiptsAllowed($receiptsAllowed)
        );

        return new DonationReceiptCreateService(
            orderRepository: $orderRepository,
            donationReceiptRepository: $donationReceiptRepository,
            donationBreakdownService: Mockery::mock(DonationBreakdownService::class),
            accountRepository: $accountRepository,
            databaseManager: Mockery::mock(DatabaseManager::class),
            logger: new NullLogger(),
        );
    }
}
