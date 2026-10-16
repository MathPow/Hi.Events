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
}
