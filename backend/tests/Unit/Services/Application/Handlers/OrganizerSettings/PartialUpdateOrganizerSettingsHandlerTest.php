<?php

namespace Tests\Unit\Services\Application\Handlers\OrganizerSettings;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerSettingsRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\DTO\PartialUpdateOrganizerSettingsDTO;
use HiEvents\Services\Application\Handlers\Organizer\Settings\PartialUpdateOrganizerSettingsHandler;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Tests\TestCase;

class PartialUpdateOrganizerSettingsHandlerTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    private OrganizerSettingsRepositoryInterface $settingsRepository;
    private OrganizerRepositoryInterface $organizerRepository;
    private PartialUpdateOrganizerSettingsHandler $handler;
    private EventRepositoryInterface $eventRepository;
    private EventSettingsRepositoryInterface $eventSettingsRepository;
    private HtmlPurifierService $purifier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->settingsRepository = Mockery::mock(OrganizerSettingsRepositoryInterface::class);
        $this->organizerRepository = Mockery::mock(OrganizerRepositoryInterface::class);

        $this->handler = new PartialUpdateOrganizerSettingsHandler(
            organizerSettingsRepository: $this->settingsRepository,
            organizerRepository: $this->organizerRepository,
            eventRepository: $this->eventRepository = Mockery::mock(EventRepositoryInterface::class),
            eventSettingsRepository: $this->eventSettingsRepository = Mockery::mock(EventSettingsRepositoryInterface::class),
            purifier: $this->purifier = Mockery::mock(HtmlPurifierService::class),
        );
    }

    public function testTrackingPixelsArePersisted(): void
    {
        $organizer = new OrganizerDomainObject();
        $organizer->setId(1);

        $existingSettings = new OrganizerSettingDomainObject();
        $existingSettings->setId(10);
        $existingSettings->setOrganizerId(1);

        $this->organizerRepository
            ->shouldReceive('findFirstWhere')
            ->with(['id' => 1, 'account_id' => '100'])
            ->once()
            ->andReturn($organizer);

        $this->settingsRepository
            ->shouldReceive('findFirstWhere')
            ->with(['organizer_id' => 1])
            ->once()
            ->andReturn($existingSettings);

        $trackingPixels = [
            ['provider' => 'facebook_pixel', 'pixel_id' => '1234567890', 'enabled' => true],
            ['provider' => 'google_tag_manager', 'pixel_id' => 'GTM-XXXXXXX', 'enabled' => true],
        ];

        $this->settingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(
                Mockery::on(function (array $attributes) use ($trackingPixels) {
                    return $attributes['tracking_pixels'] === $trackingPixels
                        && $attributes['tracking_consent_acknowledged'] === true;
                }),
                Mockery::any()
            );

        $updatedSettings = new OrganizerSettingDomainObject();
        $updatedSettings->setId(10);

        $this->settingsRepository
            ->shouldReceive('findFirst')
            ->with(10)
            ->once()
            ->andReturn($updatedSettings);

        $dto = PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'tracking_pixels' => $trackingPixels,
            'tracking_consent_acknowledged' => true,
        ]);

        $result = $this->handler->handle($dto);

        $this->assertInstanceOf(OrganizerSettingDomainObject::class, $result);
    }

    public function testTrackingPixelsDefaultToExistingWhenNotProvided(): void
    {
        $organizer = new OrganizerDomainObject();
        $organizer->setId(1);

        $existingPixels = [
            ['provider' => 'facebook_pixel', 'pixel_id' => '9999999', 'enabled' => true],
        ];

        $existingSettings = new OrganizerSettingDomainObject();
        $existingSettings->setId(10);
        $existingSettings->setOrganizerId(1);
        $existingSettings->setTrackingPixels($existingPixels);
        $existingSettings->setTrackingConsentAcknowledged(true);

        $this->organizerRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturn($organizer);

        $this->settingsRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturn($existingSettings);

        $this->settingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(
                Mockery::on(function (array $attributes) use ($existingPixels) {
                    return $attributes['tracking_pixels'] === $existingPixels
                        && $attributes['tracking_consent_acknowledged'] === true;
                }),
                Mockery::any()
            );

        $this->settingsRepository
            ->shouldReceive('findFirst')
            ->with(10)
            ->once()
            ->andReturn($existingSettings);

        // Only update SEO title, not tracking pixels
        $dto = PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'seo_title' => 'New Title',
        ]);

        $this->handler->handle($dto);
    }

    public function testFaqsAreSanitizedAndEmptyEntriesDropped(): void
    {
        $organizer = new OrganizerDomainObject();
        $organizer->setId(1);

        $existingSettings = new OrganizerSettingDomainObject();
        $existingSettings->setId(10);
        $existingSettings->setOrganizerId(1);

        $this->organizerRepository->shouldReceive('findFirstWhere')->once()->andReturn($organizer);
        $this->settingsRepository->shouldReceive('findFirstWhere')->once()->andReturn($existingSettings);

        $this->settingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(
                Mockery::on(fn(array $attributes) => $attributes['faqs'] === [
                    ['question' => 'Is parking available?', 'answer' => 'Yes, free parking on site.'],
                    ['question' => 'Are dogs allowed?', 'answer' => 'On a leash.'],
                ]),
                Mockery::any()
            );

        $this->settingsRepository->shouldReceive('findFirst')->with(10)->once()->andReturn($existingSettings);

        $dto = PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'faqs' => [
                ['question' => ' Is parking available? ', 'answer' => '<em>Yes</em>, free parking on site.'],
                ['question' => '   ', 'answer' => 'Orphan answer'],
                ['question' => '<b>Are dogs allowed?</b>', 'answer' => 'On a leash.'],
            ],
        ]);

        $this->handler->handle($dto);
    }

    public function testFaqsDefaultToExistingWhenNotProvided(): void
    {
        $organizer = new OrganizerDomainObject();
        $organizer->setId(1);

        $existingFaqs = [['question' => 'When?', 'answer' => 'Saturday.']];

        $existingSettings = new OrganizerSettingDomainObject();
        $existingSettings->setId(10);
        $existingSettings->setOrganizerId(1);
        $existingSettings->setFaqs($existingFaqs);

        $this->organizerRepository->shouldReceive('findFirstWhere')->once()->andReturn($organizer);
        $this->settingsRepository->shouldReceive('findFirstWhere')->once()->andReturn($existingSettings);

        $this->settingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['faqs'] === $existingFaqs), Mockery::any());

        $this->settingsRepository->shouldReceive('findFirst')->with(10)->once()->andReturn($existingSettings);

        $this->handler->handle(PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'seo_title' => 'New Title',
        ]));
    }

    public function testSocialMediaLayoutIsSanitizedAndStravaHandleStored(): void
    {
        $organizer = new OrganizerDomainObject();
        $organizer->setId(1);

        $existingSettings = new OrganizerSettingDomainObject();
        $existingSettings->setId(10);
        $existingSettings->setOrganizerId(1);
        $existingSettings->setSocialMediaHandles(['instagram' => 'dehorsqc']);

        $this->organizerRepository->shouldReceive('findFirstWhere')->once()->andReturn($organizer);
        $this->settingsRepository->shouldReceive('findFirstWhere')->once()->andReturn($existingSettings);

        $this->settingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(
                Mockery::on(fn(array $attributes) => $attributes['social_media_layout'] === [
                        ['platform' => 'strava', 'visible' => true],
                        ['platform' => 'instagram', 'visible' => false],
                    ]
                    && $attributes['social_media_handles'] === ['instagram' => 'dehorsqc', 'strava' => 'dehors']),
                Mockery::any()
            );

        $this->settingsRepository->shouldReceive('findFirst')->with(10)->once()->andReturn($existingSettings);

        $this->handler->handle(PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'strava_handle' => 'dehors',
            'social_media_layout' => [
                ['platform' => 'strava', 'visible' => true],
                ['platform' => 'instagram', 'visible' => false],
                ['platform' => 'strava', 'visible' => false],
                ['platform' => 'myspace', 'visible' => true],
            ],
        ]));
    }

    public function testSocialMediaLayoutDefaultsToExistingWhenNotProvided(): void
    {
        $organizer = new OrganizerDomainObject();
        $organizer->setId(1);

        $existingLayout = [['platform' => 'facebook', 'visible' => false]];

        $existingSettings = new OrganizerSettingDomainObject();
        $existingSettings->setId(10);
        $existingSettings->setOrganizerId(1);
        $existingSettings->setSocialMediaLayout($existingLayout);

        $this->organizerRepository->shouldReceive('findFirstWhere')->once()->andReturn($organizer);
        $this->settingsRepository->shouldReceive('findFirstWhere')->once()->andReturn($existingSettings);

        $this->settingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['social_media_layout'] === $existingLayout), Mockery::any());

        $this->settingsRepository->shouldReceive('findFirst')->with(10)->once()->andReturn($existingSettings);

        $this->handler->handle(PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'facebook_handle' => 'dehors.fb',
        ]));
    }

    public function testEmailFooterIsSavedAndCopiedToTheOrganizersEvents(): void
    {
        $organizer = (new OrganizerDomainObject())->setId(1);
        $existingSettings = (new OrganizerSettingDomainObject())->setId(10)->setOrganizerId(1);

        $this->organizerRepository->shouldReceive('findFirstWhere')->once()->andReturn($organizer);
        $this->settingsRepository->shouldReceive('findFirstWhere')->once()->andReturn($existingSettings);
        $this->purifier->shouldReceive('purify')->with('<p>Merci!</p>')->once()->andReturn('<p>Merci!</p>');

        $this->settingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['email_footer_message'] === '<p>Merci!</p>'), Mockery::any());

        $this->eventRepository
            ->shouldReceive('findWhere')
            ->with(['organizer_id' => 1])
            ->once()
            ->andReturn(collect([
                (new \HiEvents\DomainObjects\EventDomainObject())->setId(5),
                (new \HiEvents\DomainObjects\EventDomainObject())->setId(7),
            ]));

        $this->eventSettingsRepository
            ->shouldReceive('updateWhere')
            ->with(['email_footer_message' => '<p>Merci!</p>'], [['event_id', 'in', [5, 7]]])
            ->once();

        $this->settingsRepository->shouldReceive('findFirst')->with(10)->once()->andReturn($existingSettings);

        $this->handler->handle(PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'email_footer_message' => '<p>Merci!</p>',
        ]));
    }

    public function testAnEmptyEditorClearsTheEmailFooter(): void
    {
        $organizer = (new OrganizerDomainObject())->setId(1);
        $existingSettings = (new OrganizerSettingDomainObject())->setId(10)->setOrganizerId(1)
            ->setEmailFooterMessage('<p>Ancien</p>');

        $this->organizerRepository->shouldReceive('findFirstWhere')->once()->andReturn($organizer);
        $this->settingsRepository->shouldReceive('findFirstWhere')->once()->andReturn($existingSettings);
        $this->purifier->shouldReceive('purify')->once()->andReturn('<p></p>');

        $this->settingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['email_footer_message'] === null), Mockery::any());

        $this->eventRepository->shouldReceive('findWhere')->once()->andReturn(collect());
        $this->eventSettingsRepository->shouldNotReceive('updateWhere');
        $this->settingsRepository->shouldReceive('findFirst')->once()->andReturn($existingSettings);

        $this->handler->handle(PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'email_footer_message' => '<p></p>',
        ]));
    }

    public function testDefaultInvoiceTaxDetailsAreSanitizedAndSaved(): void
    {
        $this->expectSettingsUpdate(new OrganizerSettingDomainObject, function (array $attributes) {
            return $attributes['default_invoice_tax_details'] === '<p>TPS : 123456789 RT0001</p>';
        });

        $this->purifier->shouldReceive('purify')
            ->once()
            ->with('<p>TPS : 123456789 RT0001</p><script>x</script>')
            ->andReturn('<p>TPS : 123456789 RT0001</p>');

        $this->handler->handle(PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'default_invoice_tax_details' => '<p>TPS : 123456789 RT0001</p><script>x</script>',
        ]));
    }

    public function testDefaultInvoiceTaxDetailsAreKeptWhenNotProvided(): void
    {
        $existing = new OrganizerSettingDomainObject;
        $existing->setDefaultInvoiceTaxDetails('<p>TVQ : 1234567890 TQ0001</p>');

        $this->expectSettingsUpdate($existing, function (array $attributes) {
            return $attributes['default_invoice_tax_details'] === '<p>TVQ : 1234567890 TQ0001</p>';
        });

        $this->handler->handle(PartialUpdateOrganizerSettingsDTO::from([
            'organizer_id' => 1,
            'account_id' => '100',
            'default_show_marketing_opt_in' => true,
        ]));
    }

    private function expectSettingsUpdate(OrganizerSettingDomainObject $existing, callable $check): void
    {
        $organizer = new OrganizerDomainObject;
        $organizer->setId(1);
        $existing->setId(10);
        $existing->setOrganizerId(1);

        $this->organizerRepository->shouldReceive('findFirstWhere')->once()->andReturn($organizer);
        $this->settingsRepository->shouldReceive('findFirstWhere')->once()->andReturn($existing);
        $this->settingsRepository->shouldReceive('updateWhere')->once()->with(Mockery::on($check), Mockery::any());
        $this->settingsRepository->shouldReceive('findFirst')->with(10)->once()->andReturn($existing);
    }
}
