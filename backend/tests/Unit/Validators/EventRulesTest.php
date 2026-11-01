<?php

namespace Tests\Unit\Validators;

use HiEvents\Validators\EventRules;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class EventRulesTest extends TestCase
{
    public function testAPlaceNameAloneIsEnough(): void
    {
        $this->assertTrue($this->validate(['venue_name' => 'Mont Sainte-Anne'])->passes());
    }

    public function testAFullStreetAddressWithoutAName(): void
    {
        $this->assertTrue($this->validate([
            'address_line_1' => '2000 boulevard du Beau-Pré',
            'city' => 'Beaupré',
            'zip_or_postal_code' => 'G0A 1E0',
            'country' => 'CA',
        ])->passes());
    }

    public function testAStreetAddressNeedsItsCityPostalCodeAndCountry(): void
    {
        $validator = $this->validate(['address_line_1' => '2000 boulevard du Beau-Pré']);

        $this->assertTrue($validator->fails());
        $this->assertEqualsCanonicalizing([
            'location_details.city',
            'location_details.zip_or_postal_code',
            'location_details.country',
        ], array_keys($validator->errors()->toArray()));
    }

    public function testAnEmptyLocationNeedsANameOrAnAddress(): void
    {
        $validator = $this->validate(['venue_name' => '', 'address_line_1' => '']);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('location_details.venue_name', $validator->errors()->toArray());
    }

    public function testAnUpdateWithoutALocationKeepsItAsItIs(): void
    {
        $this->assertTrue($this->validateData([
            'title' => 'Rando aux couleurs',
            'start_date' => '2026-11-15 09:00:00',
            'organizer_id' => 1,
        ])->passes());
    }

    private function validate(array $location): \Illuminate\Validation\Validator
    {
        return $this->validateData([
            'title' => 'Rando aux couleurs',
            'start_date' => '2026-11-15 09:00:00',
            'organizer_id' => 1,
            'location_details' => $location,
        ]);
    }

    private function validateData(array $data): \Illuminate\Validation\Validator
    {
        $rules = new class($data) {
            use EventRules;

            public function __construct(private readonly array $data)
            {
            }

            public function input(string $key): mixed
            {
                return data_get($this->data, $key);
            }
        };

        return Validator::make($data, $rules->eventRules(), $rules->eventMessages());
    }
}
