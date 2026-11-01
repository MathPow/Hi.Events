<?php

namespace Tests\Unit\Http\Request\EventSettings;

use HiEvents\DomainObjects\Enums\TicketDateDisplayMode;
use HiEvents\Http\Request\EventSettings\UpdateEventSettingsRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class UpdateEventSettingsRequestTest extends TestCase
{
    public function test_valid_date_display_modes_are_accepted(): void
    {
        foreach (TicketDateDisplayMode::valuesArray() as $mode) {
            $validator = Validator::make(
                ['ticket_design_settings' => ['date_display_mode' => $mode]],
                (new UpdateEventSettingsRequest)->rules()
            );

            $this->assertFalse(
                $validator->errors()->has('ticket_design_settings.date_display_mode'),
                "Expected '{$mode}' to be a valid date display mode"
            );
        }
    }

    public function test_invalid_date_display_mode_is_rejected(): void
    {
        $validator = Validator::make(
            ['ticket_design_settings' => ['date_display_mode' => 'NOT_A_MODE']],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertTrue($validator->errors()->has('ticket_design_settings.date_display_mode'));
    }

    public function test_date_display_mode_is_optional(): void
    {
        $validator = Validator::make(
            ['ticket_design_settings' => ['accent_color' => '#333333']],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertFalse($validator->errors()->has('ticket_design_settings.date_display_mode'));
    }

    public function test_allow_copy_details_to_all_attendees_accepts_boolean(): void
    {
        $validator = Validator::make(
            ['allow_copy_details_to_all_attendees' => false],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertFalse($validator->errors()->has('allow_copy_details_to_all_attendees'));
    }

    public function test_allow_copy_details_to_all_attendees_rejects_non_boolean(): void
    {
        $validator = Validator::make(
            ['allow_copy_details_to_all_attendees' => 'not-a-boolean'],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertTrue($validator->errors()->has('allow_copy_details_to_all_attendees'));
    }

    public function test_allow_copy_details_to_all_attendees_is_optional(): void
    {
        $validator = Validator::make(
            ['ticket_design_settings' => ['accent_color' => '#333333']],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertFalse($validator->errors()->has('allow_copy_details_to_all_attendees'));
    }

    public function test_product_info_block_accepts_message_with_button(): void
    {
        $validator = Validator::make(
            [
                'product_info_message' => '<p>Support the cause with an extra donation.</p>',
                'product_info_button_text' => 'Donate',
                'product_info_button_url' => 'https://example.com/donate',
            ],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertFalse($validator->errors()->hasAny([
            'product_info_message',
            'product_info_button_text',
            'product_info_button_url',
        ]));
    }

    public function test_product_info_block_accepts_message_without_button(): void
    {
        $validator = Validator::make(
            [
                'product_info_message' => '<p>Bring a headlamp.</p>',
                'product_info_button_text' => null,
                'product_info_button_url' => null,
            ],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertFalse($validator->errors()->hasAny([
            'product_info_button_text',
            'product_info_button_url',
        ]));
    }

    public function test_product_info_button_url_requires_button_text(): void
    {
        $validator = Validator::make(
            ['product_info_button_url' => 'https://example.com/donate'],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertTrue($validator->errors()->has('product_info_button_text'));
    }

    public function test_product_info_button_text_requires_button_url(): void
    {
        $validator = Validator::make(
            ['product_info_button_text' => 'Donate'],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertTrue($validator->errors()->has('product_info_button_url'));
    }

    public function test_product_info_button_url_rejects_non_http_schemes(): void
    {
        foreach (['javascript:alert(1)', 'ftp://example.com/file', 'not a url'] as $url) {
            $validator = Validator::make(
                ['product_info_button_text' => 'Donate', 'product_info_button_url' => $url],
                (new UpdateEventSettingsRequest)->rules()
            );

            $this->assertTrue(
                $validator->errors()->has('product_info_button_url'),
                "Expected '{$url}' to be rejected"
            );
        }
    }

    public function test_product_info_icon_accepts_known_icons_and_null(): void
    {
        foreach (['heart', 'gift', null] as $icon) {
            $validator = Validator::make(
                ['product_info_icon' => $icon],
                (new UpdateEventSettingsRequest)->rules()
            );

            $this->assertFalse($validator->errors()->has('product_info_icon'));
        }
    }

    public function test_product_info_icon_rejects_unknown_icon(): void
    {
        $validator = Validator::make(
            ['product_info_icon' => 'skull'],
            (new UpdateEventSettingsRequest)->rules()
        );

        $this->assertTrue($validator->errors()->has('product_info_icon'));
    }

    public function test_a_place_name_alone_is_a_location(): void
    {
        $validator = $this->validateLocation(['venue_name' => 'Mont Sainte-Anne']);

        $this->assertFalse($validator->fails());
    }

    public function test_a_street_address_needs_its_city_postal_code_and_country(): void
    {
        $validator = $this->validateLocation(['address_line_1' => '2000 boulevard du Beau-Pré']);

        $this->assertEqualsCanonicalizing([
            'location_details.city',
            'location_details.zip_or_postal_code',
            'location_details.country',
        ], array_keys($validator->errors()->toArray()));
    }

    public function test_an_empty_location_needs_a_name_or_an_address(): void
    {
        $validator = $this->validateLocation(['venue_name' => '', 'address_line_1' => '']);

        $this->assertTrue($validator->errors()->has('location_details.venue_name'));
    }

    public function test_settings_without_a_location_need_no_address(): void
    {
        $data = ['seo_title' => 'Rando aux couleurs'];
        $request = UpdateEventSettingsRequest::create('/', 'PATCH', $data);

        $this->assertFalse(Validator::make($data, $request->rules(), $request->messages())->fails());
    }

    private function validateLocation(array $location): \Illuminate\Validation\Validator
    {
        $data = ['location_details' => $location];
        $request = UpdateEventSettingsRequest::create('/', 'PATCH', $data);

        return Validator::make($data, $request->rules(), $request->messages());
    }
}
