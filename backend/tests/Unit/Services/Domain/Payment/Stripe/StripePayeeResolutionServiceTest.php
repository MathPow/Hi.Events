<?php

namespace Tests\Unit\Services\Domain\Payment\Stripe;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\AccountStripePlatformDomainObject;
use HiEvents\DomainObjects\Enums\StripePlatform;
use HiEvents\DomainObjects\OrganizerStripePlatformDomainObject;
use HiEvents\Repository\Interfaces\OrganizerStripePlatformRepositoryInterface;
use HiEvents\Services\Domain\Payment\Stripe\StripePayeeResolutionService;
use Illuminate\Support\Collection;
use Mockery as m;
use Mockery\MockInterface;
use Tests\TestCase;

class StripePayeeResolutionServiceTest extends TestCase
{
    private StripePayeeResolutionService $service;
    private MockInterface|OrganizerStripePlatformRepositoryInterface $organizerStripePlatformRepository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organizerStripePlatformRepository = m::mock(OrganizerStripePlatformRepositoryInterface::class);
        $this->service = new StripePayeeResolutionService($this->organizerStripePlatformRepository);
    }

    public function testAConnectedOrganizerIsPaidDirectly(): void
    {
        $this->organizerStripePlatformRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with(['organizer_id' => 2])
            ->andReturn($this->makeOrganizerPlatform(setupComplete: true));

        $payee = $this->service->resolveForOrganizer(2, $this->makeAccount());

        $this->assertSame('acct_organizer', $payee->stripeAccountId);
        $this->assertTrue($payee->isOrganizerAccount);
    }

    /**
     * Sans connexion propre, la vente doit passer quand meme: le compte de la
     * billetterie encaisse plutot que de perdre la commande.
     */
    public function testAnOrganizerWithoutStripeFallsBackToTheAccount(): void
    {
        $this->organizerStripePlatformRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturnNull();

        $payee = $this->service->resolveForOrganizer(2, $this->makeAccount());

        $this->assertSame('acct_platform', $payee->stripeAccountId);
        $this->assertFalse($payee->isOrganizerAccount);
    }

    /**
     * Un compte connecte dont l'onboarding Stripe n'est pas fini ne peut pas
     * encaisser: y envoyer l'acheteur ferait echouer le paiement.
     */
    public function testAnUnfinishedOrganizerSetupFallsBackToTheAccount(): void
    {
        $this->organizerStripePlatformRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturn($this->makeOrganizerPlatform(setupComplete: false));

        $payee = $this->service->resolveForOrganizer(2, $this->makeAccount());

        $this->assertSame('acct_platform', $payee->stripeAccountId);
        $this->assertFalse($payee->isOrganizerAccount);
    }

    public function testAnEventWithoutOrganizerFallsBackToTheAccount(): void
    {
        $this->organizerStripePlatformRepository->shouldNotReceive('findFirstWhere');

        $payee = $this->service->resolveForOrganizer(null, $this->makeAccount());

        $this->assertSame('acct_platform', $payee->stripeAccountId);
    }

    /**
     * Les cles utilisees pour debiter doivent etre celles de la plateforme qui a
     * cree le compte connecte, sinon Stripe refuse le paiement.
     */
    public function testThePlatformOfTheOrganizerAccountIsCarriedAlong(): void
    {
        $this->organizerStripePlatformRepository
            ->shouldReceive('findFirstWhere')
            ->andReturn($this->makeOrganizerPlatform(setupComplete: true, platform: StripePlatform::IRELAND->value));

        $payee = $this->service->resolveForOrganizer(2, $this->makeAccount());

        $this->assertSame(StripePlatform::IRELAND, $payee->platform);
    }

    private function makeOrganizerPlatform(
        bool    $setupComplete,
        ?string $platform = null,
    ): OrganizerStripePlatformDomainObject
    {
        $organizerPlatform = (new OrganizerStripePlatformDomainObject())
            ->setId(1)
            ->setOrganizerId(2)
            ->setStripeAccountId('acct_organizer')
            ->setStripeConnectPlatform($platform);

        if ($setupComplete) {
            $organizerPlatform->setStripeSetupCompletedAt('2026-09-01 00:00:00');
        }

        return $organizerPlatform;
    }

    private function makeAccount(): AccountDomainObject
    {
        $accountPlatform = (new AccountStripePlatformDomainObject())
            ->setId(9)
            ->setStripeAccountId('acct_platform')
            ->setStripeSetupCompletedAt('2026-01-01 00:00:00')
            ->setCreatedAt('2026-01-01 00:00:00');

        $account = (new AccountDomainObject())->setId(1);
        $account->setAccountStripePlatforms(new Collection([$accountPlatform]));

        return $account;
    }
}
