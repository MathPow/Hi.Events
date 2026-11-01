<?php

namespace Tests\Unit\DomainObjects;

use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use Tests\TestCase;

class OrganizerSettingSocialMediaTest extends TestCase
{
    public function test_handles_follow_the_layout_order_and_skip_hidden_ones(): void
    {
        $settings = (new OrganizerSettingDomainObject)
            ->setSocialMediaHandles(['facebook' => 'dehors.fb', 'instagram' => 'dehorsqc', 'tiktok' => 'dehors.tt', 'strava' => 'dehors'])
            ->setSocialMediaLayout([
                ['platform' => 'instagram', 'visible' => true],
                ['platform' => 'strava', 'visible' => true],
                ['platform' => 'tiktok', 'visible' => false],
                ['platform' => 'facebook', 'visible' => true],
            ]);

        $this->assertSame(
            ['instagram' => 'dehorsqc', 'strava' => 'dehors', 'facebook' => 'dehors.fb'],
            $settings->getVisibleSocialMediaHandles(),
        );
    }

    public function test_handles_missing_from_the_layout_follow_in_their_stored_order(): void
    {
        $settings = (new OrganizerSettingDomainObject)
            ->setSocialMediaHandles(['facebook' => 'dehors.fb', 'instagram' => 'dehorsqc', 'youtube' => 'dehors'])
            ->setSocialMediaLayout([
                ['platform' => 'youtube', 'visible' => true],
                ['platform' => 'linkedin', 'visible' => true],
            ]);

        $this->assertSame(
            ['youtube' => 'dehors', 'facebook' => 'dehors.fb', 'instagram' => 'dehorsqc'],
            $settings->getVisibleSocialMediaHandles(),
        );
    }

    public function test_without_layout_every_handle_is_shown(): void
    {
        $settings = (new OrganizerSettingDomainObject)
            ->setSocialMediaHandles(['instagram' => 'dehorsqc', 'facebook' => '']);

        $this->assertSame(['instagram' => 'dehorsqc'], $settings->getVisibleSocialMediaHandles());
        $this->assertSame([], (new OrganizerSettingDomainObject)->getVisibleSocialMediaHandles());
    }
}
