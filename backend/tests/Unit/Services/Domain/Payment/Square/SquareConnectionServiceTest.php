<?php

namespace Tests\Unit\Services\Domain\Payment\Square;

use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;
use HiEvents\DomainObjects\Enums\SquareEnvironment;
use HiEvents\Exceptions\Square\SquareApiException;
use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Repository\Interfaces\AccountSquareCredentialRepositoryInterface;
use HiEvents\Services\Domain\Payment\Square\SquareConnectionService;
use HiEvents\Services\Domain\Payment\Square\SquareOAuthService;
use HiEvents\Services\Infrastructure\Square\SquareClient;
use HiEvents\Services\Infrastructure\Square\SquareClientFactory;
use HiEvents\Services\Infrastructure\Square\SquareConfigurationService;
use Mockery as m;
use Mockery\MockInterface;
use Psr\Log\LoggerInterface;
use Tests\TestCase;

class SquareConnectionServiceTest extends TestCase
{
    private SquareConnectionService $service;
    private MockInterface|SquareOAuthService $oAuthService;
    private MockInterface|SquareClientFactory $clientFactory;
    private MockInterface|SquareClient $client;
    private MockInterface|AccountSquareCredentialRepositoryInterface $credentialRepository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->oAuthService = m::mock(SquareOAuthService::class);
        $this->clientFactory = m::mock(SquareClientFactory::class);
        $this->client = m::mock(SquareClient::class);
        $this->credentialRepository = m::mock(AccountSquareCredentialRepositoryInterface::class);

        $configurationService = m::mock(SquareConfigurationService::class);
        $configurationService->shouldReceive('getEnvironment')->andReturn(SquareEnvironment::SANDBOX);
        $configurationService->shouldReceive('isOAuthConfigured')->andReturn(true);

        $this->clientFactory->shouldReceive('createForCredential')->andReturn($this->client);
        $this->oAuthService->shouldReceive('ensureFreshTokens')->andReturnUsing(fn($credential) => $credential);

        $this->service = new SquareConnectionService(
            oAuthService: $this->oAuthService,
            clientFactory: $this->clientFactory,
            configurationService: $configurationService,
            credentialRepository: $this->credentialRepository,
            logger: m::mock(LoggerInterface::class)->shouldIgnoreMissing(),
        );
    }

    public function testListLocationsMapsTheSquareResponse(): void
    {
        $this->client->shouldReceive('listLocations')->once()->andReturn([
            'locations' => [
                ['id' => 'L1', 'name' => 'Comptoir', 'currency' => 'CAD', 'country' => 'CA', 'status' => 'ACTIVE'],
                ['id' => 'L2', 'status' => 'INACTIVE'],
            ],
        ]);

        $locations = $this->service->listLocations($this->makeCredential());

        $this->assertCount(2, $locations);
        $this->assertSame('Comptoir', $locations[0]->name);
        $this->assertSame('CAD', $locations[0]->currency);
        $this->assertTrue($locations[0]->isActive);
        // Sans nom, Square renvoie parfois seulement l'identifiant.
        $this->assertSame('L2', $locations[1]->name);
        $this->assertFalse($locations[1]->isActive);
    }

    /**
     * La page de reglages doit rester affichable meme si Square refuse la liste.
     */
    public function testListLocationsReturnsNothingWhenSquareFails(): void
    {
        $this->client->shouldReceive('listLocations')->once()->andThrow(new SquareApiException('boom'));

        $this->assertSame([], $this->service->listLocations($this->makeCredential()));
    }

    /**
     * Un location_id arbitraire serait accepte sans cette verification, et chaque
     * paiement echouerait ensuite chez Square sans explication.
     */
    public function testSelectingALocationOfAnotherMerchantIsRejected(): void
    {
        $this->client->shouldReceive('listLocations')->andReturn([
            'locations' => [['id' => 'L1', 'name' => 'Comptoir', 'status' => 'ACTIVE']],
        ]);

        $this->credentialRepository->shouldNotReceive('updateFromArray');

        $this->expectException(SquareNotConnectedException::class);

        $this->service->selectLocation($this->makeCredential(), 'L-someone-else');
    }

    public function testSelectingALocationCompletesTheSetup(): void
    {
        $this->client->shouldReceive('listLocations')->andReturn([
            'locations' => [['id' => 'L1', 'name' => 'Comptoir', 'currency' => 'CAD', 'country' => 'CA', 'status' => 'ACTIVE']],
        ]);

        $this->credentialRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->withArgs(function (int $id, array $attributes) {
                return $id === 7
                    && $attributes['location_id'] === 'L1'
                    && $attributes['currency'] === 'CAD'
                    && $attributes['country'] === 'CA'
                    && $attributes['setup_completed_at'] !== null;
            })
            ->andReturn($this->makeCredential());

        $this->service->selectLocation($this->makeCredential(), 'L1');
    }

    /**
     * Le cas courant est un marchand avec un seul point de vente: lui demander de
     * le choisir serait une etape pour rien.
     */
    public function testConnectingAutoSelectsTheOnlyActiveLocation(): void
    {
        $credential = $this->makeCredential();

        $this->oAuthService->shouldReceive('exchangeCodeForTokens')->once()->with(3, 'auth-code')->andReturn($credential);
        $this->client->shouldReceive('retrieveMerchant')->andReturn(['merchant' => ['business_name' => 'DEHORS']]);
        $this->client->shouldReceive('listLocations')->andReturn([
            'locations' => [
                ['id' => 'L1', 'name' => 'Comptoir', 'currency' => 'CAD', 'country' => 'CA', 'status' => 'ACTIVE'],
                ['id' => 'L2', 'name' => 'Ferme', 'status' => 'INACTIVE'],
            ],
        ]);

        $this->credentialRepository->shouldReceive('updateFromArray')->andReturn($credential);

        $connection = $this->service->connect(3, 'auth-code');

        $this->assertCount(2, $connection->locations);
    }

    public function testConnectingLeavesTheChoiceOpenWithSeveralLocations(): void
    {
        $credential = $this->makeCredential();

        $this->oAuthService->shouldReceive('exchangeCodeForTokens')->once()->andReturn($credential);
        $this->client->shouldReceive('retrieveMerchant')->andReturn([]);
        $this->client->shouldReceive('listLocations')->andReturn([
            'locations' => [
                ['id' => 'L1', 'name' => 'Comptoir', 'status' => 'ACTIVE'],
                ['id' => 'L2', 'name' => 'Kiosque', 'status' => 'ACTIVE'],
            ],
        ]);

        // Seul l'enregistrement des details marchands doit ecrire; aucun point de
        // vente ne doit etre choisi a la place du marchand.
        $this->credentialRepository
            ->shouldReceive('updateFromArray')
            ->andReturnUsing(function (int $id, array $attributes) use ($credential) {
                $this->assertArrayNotHasKey('location_id', $attributes);

                return $credential;
            });

        $this->service->connect(3, 'auth-code');
    }

    private function makeCredential(): AccountSquareCredentialDomainObject
    {
        return (new AccountSquareCredentialDomainObject())
            ->setId(7)
            ->setAccountId(3)
            ->setEnvironment(SquareEnvironment::SANDBOX->value)
            ->setMerchantId('MERCHANT-1')
            ->setAccessToken('token');
    }
}
