<?php

namespace Tests\Unit\Services\Application\Handlers\EventSettings;

use HiEvents\DomainObjects\Enums\CapacityChangeDirection;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Events\CapacityChangedEvent;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventSettings\DTO\UpdateEventSettingsDTO;
use HiEvents\Services\Application\Handlers\EventSettings\UpdateEventSettingsHandler;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Facades\Event;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Tests\TestCase;

class UpdateEventSettingsHandlerTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    private EventSettingsRepositoryInterface $eventSettingsRepository;
    private HtmlPurifierService $purifier;
    private DatabaseManager $databaseManager;
    private UpdateEventSettingsHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->eventSettingsRepository = Mockery::mock(EventSettingsRepositoryInterface::class);
        $this->purifier = Mockery::mock(HtmlPurifierService::class);
        $this->databaseManager = Mockery::mock(DatabaseManager::class);

        $this->purifier->shouldReceive('purify')->andReturnUsing(fn($v) => $v);

        $this->databaseManager
            ->shouldReceive('transaction')
            ->andReturnUsing(fn($callback) => $callback());

        $this->handler = new UpdateEventSettingsHandler(
            eventSettingsRepository: $this->eventSettingsRepository,
            purifier: $this->purifier,
            databaseManager: $this->databaseManager,
        );
    }

    public function testDispatchesCapacityEventWhenAutoProcessToggledOn(): void
    {
        Event::fake();

        $existingSettings = new EventSettingDomainObject();
        $existingSettings->setWaitlistAutoProcess(false);

        $this->eventSettingsRepository
            ->shouldReceive('findFirstWhere')
            ->with(['event_id' => 1])
            ->twice()
            ->andReturn($existingSettings);

        $this->eventSettingsRepository
            ->shouldReceive('updateWhere')
            ->once();

        $dto = $this->createDTO(waitlist_auto_process: true);
        $this->handler->handle($dto);

        Event::assertDispatched(CapacityChangedEvent::class, function ($event) {
            return $event->eventId === 1
                && $event->productId === null
                && $event->direction === CapacityChangeDirection::INCREASED;
        });
    }

    public function testDoesNotDispatchEventWhenAutoProcessAlreadyEnabled(): void
    {
        Event::fake();

        $existingSettings = new EventSettingDomainObject();
        $existingSettings->setWaitlistAutoProcess(true);

        $this->eventSettingsRepository
            ->shouldReceive('findFirstWhere')
            ->with(['event_id' => 1])
            ->twice()
            ->andReturn($existingSettings);

        $this->eventSettingsRepository
            ->shouldReceive('updateWhere')
            ->once();

        $dto = $this->createDTO(waitlist_auto_process: true);
        $this->handler->handle($dto);

        Event::assertNotDispatched(CapacityChangedEvent::class);
    }

    public function testDoesNotDispatchEventWhenAutoProcessDisabled(): void
    {
        Event::fake();

        $existingSettings = new EventSettingDomainObject();
        $existingSettings->setWaitlistAutoProcess(true);

        $this->eventSettingsRepository
            ->shouldReceive('findFirstWhere')
            ->with(['event_id' => 1])
            ->twice()
            ->andReturn($existingSettings);

        $this->eventSettingsRepository
            ->shouldReceive('updateWhere')
            ->once();

        $dto = $this->createDTO(waitlist_auto_process: false);
        $this->handler->handle($dto);

        Event::assertNotDispatched(CapacityChangedEvent::class);
    }

    public function testPersistsAllowCopyDetailsToAllAttendees(): void
    {
        Event::fake();

        $existingSettings = new EventSettingDomainObject();

        $this->eventSettingsRepository
            ->shouldReceive('findFirstWhere')
            ->with(['event_id' => 1])
            ->twice()
            ->andReturn($existingSettings);

        $captured = null;
        $this->eventSettingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->andReturnUsing(function (...$args) use (&$captured) {
                foreach ($args as $arg) {
                    if (is_array($arg) && array_key_exists('allow_copy_details_to_all_attendees', $arg)) {
                        $captured = $arg['allow_copy_details_to_all_attendees'];
                    }
                }
                return 1;
            });

        $this->handler->handle($this->createDTO(allow_copy_details_to_all_attendees: false));

        $this->assertFalse(
            $captured,
            'Expected allow_copy_details_to_all_attendees=false to be persisted via updateWhere'
        );
    }

    public function testPurifiesProductInfoMessageAndNormalisesButtonFields(): void
    {
        Event::fake();

        $purifier = Mockery::mock(HtmlPurifierService::class);
        $purifier->shouldReceive('purify')
            ->with('<p>Donate</p><script>alert(1)</script>')
            ->once()
            ->andReturn('<p>Donate</p>');
        $purifier->shouldReceive('purify')->andReturnUsing(fn($v) => $v);

        $handler = new UpdateEventSettingsHandler(
            eventSettingsRepository: $this->eventSettingsRepository,
            purifier: $purifier,
            databaseManager: $this->databaseManager,
        );

        $this->eventSettingsRepository
            ->shouldReceive('findFirstWhere')
            ->with(['event_id' => 1])
            ->twice()
            ->andReturn(new EventSettingDomainObject());

        $captured = null;
        $this->eventSettingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->andReturnUsing(function (array $attributes) use (&$captured) {
                $captured = $attributes;
                return 1;
            });

        $handler->handle($this->createDTO(
            product_info_message: '<p>Donate</p><script>alert(1)</script>',
            product_info_button_text: '  Make a donation  ',
            product_info_button_url: ' https://example.com/donate ',
            product_info_icon: 'heart',
        ));

        $this->assertSame('<p>Donate</p>', $captured['product_info_message']);
        $this->assertSame('Make a donation', $captured['product_info_button_text']);
        $this->assertSame('https://example.com/donate', $captured['product_info_button_url']);
        $this->assertSame('heart', $captured['product_info_icon']);
    }

    public function testStoresBlankProductInfoButtonFieldsAsNull(): void
    {
        Event::fake();

        $this->eventSettingsRepository
            ->shouldReceive('findFirstWhere')
            ->with(['event_id' => 1])
            ->twice()
            ->andReturn(new EventSettingDomainObject());

        $captured = null;
        $this->eventSettingsRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->andReturnUsing(function (array $attributes) use (&$captured) {
                $captured = $attributes;
                return 1;
            });

        $this->handler->handle($this->createDTO(
            product_info_button_text: '   ',
            product_info_button_url: null,
        ));

        $this->assertNull($captured['product_info_button_text']);
        $this->assertNull($captured['product_info_button_url']);
    }

    private function createDTO(
        ?bool   $waitlist_auto_process = null,
        bool    $allow_copy_details_to_all_attendees = true,
        ?string $product_info_message = null,
        ?string $product_info_button_text = null,
        ?string $product_info_button_url = null,
        ?string $product_info_icon = null,
    ): UpdateEventSettingsDTO
    {
        return UpdateEventSettingsDTO::fromArray([
            'account_id' => 1,
            'event_id' => 1,
            'post_checkout_message' => null,
            'pre_checkout_message' => null,
            'email_footer_message' => null,
            'continue_button_text' => 'Continue',
            'support_email' => 'test@test.com',
            'homepage_background_color' => '#ffffff',
            'homepage_primary_color' => '#000000',
            'homepage_primary_text_color' => '#000000',
            'homepage_secondary_color' => '#000000',
            'homepage_secondary_text_color' => '#ffffff',
            'homepage_body_background_color' => '#ffffff',
            'homepage_background_type' => 'COLOR',
            'require_attendee_details' => false,
            'attendee_details_collection_method' => 'PER_TICKET',
            'order_timeout_in_minutes' => 15,
            'website_url' => null,
            'maps_url' => null,
            'seo_title' => null,
            'seo_description' => null,
            'seo_keywords' => null,
            'allow_copy_details_to_all_attendees' => $allow_copy_details_to_all_attendees,
            'waitlist_auto_process' => $waitlist_auto_process,
            'waitlist_offer_timeout_minutes' => 60,
            'product_info_message' => $product_info_message,
            'product_info_button_text' => $product_info_button_text,
            'product_info_button_url' => $product_info_button_url,
            'product_info_icon' => $product_info_icon,
        ]);
    }
}
