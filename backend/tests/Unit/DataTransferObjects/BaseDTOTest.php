<?php

namespace Tests\Unit\DataTransferObjects;

use HiEvents\DataTransferObjects\AddressDTO;
use HiEvents\Services\Application\Handlers\Event\DTO\CreateEventDTO;
use Tests\TestCase;

class BaseDTOTest extends TestCase
{
    public function testBuildsNestedDataObjectsFromArrays(): void
    {
        $dto = CreateEventDTO::fromArray([
            'title' => 'Rando aux couleurs',
            'organizer_id' => 1,
            'account_id' => 2,
            'user_id' => 3,
            'start_date' => '2026-11-15 09:00:00',
            'location_details' => ['venue_name' => 'Mont Sainte-Anne'],
        ]);

        $this->assertInstanceOf(AddressDTO::class, $dto->location_details);
        $this->assertSame('Mont Sainte-Anne', $dto->location_details->venue_name);
        $this->assertNull($dto->location_details->city);
    }
}
