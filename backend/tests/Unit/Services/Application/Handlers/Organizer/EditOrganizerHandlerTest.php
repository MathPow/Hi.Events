<?php

namespace Tests\Unit\Services\Application\Handlers\Organizer;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\DTO\EditOrganizerDTO;
use HiEvents\Services\Application\Handlers\Organizer\EditOrganizerHandler;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;
use Illuminate\Database\DatabaseManager;
use Mockery;
use Tests\TestCase;

class EditOrganizerHandlerTest extends TestCase
{
    public function test_it_saves_the_donation_url(): void
    {
        $repository = Mockery::mock(OrganizerRepositoryInterface::class);
        $databaseManager = Mockery::mock(DatabaseManager::class);
        $purifier = Mockery::mock(HtmlPurifierService::class);

        $databaseManager->shouldReceive('transaction')->andReturnUsing(fn ($callback) => $callback());
        $purifier->shouldReceive('purify')->andReturnArg(0);

        $repository->shouldReceive('updateWhere')
            ->once()
            ->withArgs(fn (array $attributes) => $attributes['donation_url'] === 'https://dehorsqc.com/don');
        $repository->shouldReceive('loadRelation')->andReturnSelf();
        $repository->shouldReceive('findFirstWhere')->andReturn(new OrganizerDomainObject);

        $handler = new EditOrganizerHandler($repository, $databaseManager, $purifier);

        $handler->handle(new EditOrganizerDTO(
            id: 1,
            name: 'DehorsQC',
            email: 'info@dehorsqc.com',
            account_id: 1,
            timezone: 'America/Toronto',
            currency: 'CAD',
            donation_url: 'https://dehorsqc.com/don',
        ));
    }
}
