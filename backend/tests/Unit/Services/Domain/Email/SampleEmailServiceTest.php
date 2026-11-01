<?php

namespace Tests\Unit\Services\Domain\Email;

use HiEvents\DomainObjects\EmailTemplateDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Mail\Attendee\AttendeeTicketMail;
use HiEvents\Mail\Order\OrderSummary;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Services\Domain\Email\DTO\RenderedEmailTemplateDTO;
use HiEvents\Services\Domain\Email\EmailTemplateService;
use HiEvents\Services\Domain\Email\EmailTokenContextBuilder;
use HiEvents\Services\Domain\Email\SampleEmailService;
use Mockery as m;
use Mockery\MockInterface;
use Tests\TestCase;

class SampleEmailServiceTest extends TestCase
{
    private EventRepositoryInterface&MockInterface $eventRepository;
    private ProductRepositoryInterface&MockInterface $productRepository;
    private EmailTemplateService&MockInterface $emailTemplateService;
    private SampleEmailService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->eventRepository = m::mock(EventRepositoryInterface::class);
        $this->productRepository = m::mock(ProductRepositoryInterface::class);
        $this->emailTemplateService = m::mock(EmailTemplateService::class);

        $this->eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->productRepository->shouldReceive('loadRelation')->andReturnSelf();

        $this->service = new SampleEmailService(
            $this->eventRepository,
            $this->productRepository,
            $this->emailTemplateService,
            app(EmailTokenContextBuilder::class),
        );
    }

    public function test_default_order_confirmation_uses_the_latest_event_and_its_ticket(): void
    {
        $this->eventRepository->shouldReceive('findWhere')->once()->andReturn(collect([$this->event()]));
        $this->productRepository->shouldReceive('findFirstWhere')->once()->andReturn($this->ticket(42.5));
        $this->emailTemplateService
            ->shouldReceive('getTemplateByType')
            ->once()
            ->with(EmailTemplateType::ORDER_CONFIRMATION, 3, null, 7)
            ->andReturnNull();

        $mail = $this->service->buildMail(EmailTemplateType::ORDER_CONFIRMATION, $this->organizer());

        $this->assertInstanceOf(OrderSummary::class, $mail);
        $html = $mail->render();
        $this->assertStringContainsString('Course des Lièvres', $html);
        $this->assertStringContainsString('85.00', $html);
        $this->assertStringContainsString('Sulpace', $html);
    }

    public function test_the_organizer_template_is_rendered_with_the_sample_data(): void
    {
        $template = (new EmailTemplateDomainObject())
            ->setSubject('Merci {{ order.first_name }}')
            ->setBody('Bonjour {{ order.first_name }}, rendez-vous à {{ event.title }}')
            ->setCta(['label' => 'Voir', 'url_token' => 'order.url']);

        $this->eventRepository->shouldReceive('findWhere')->andReturn(collect([$this->event()]));
        $this->productRepository->shouldReceive('findFirstWhere')->andReturnNull();
        $this->emailTemplateService
            ->shouldReceive('getTemplateByType')
            ->with(EmailTemplateType::ORDER_CONFIRMATION, 3, null, 7)
            ->andReturn($template);
        $this->emailTemplateService
            ->shouldReceive('renderTemplate')
            ->once()
            ->withArgs(function (EmailTemplateDomainObject $given, array $context) use ($template) {
                return $given === $template
                    && $context['order']['first_name'] === SampleEmailService::SAMPLE_FIRST_NAME
                    && $context['event']['title'] === 'Course des Lièvres'
                    && $context['organizer']['name'] === 'Sulpace';
            })
            ->andReturn(new RenderedEmailTemplateDTO(subject: 'Merci Marie', body: '<p>Bonjour Marie</p>', cta: null));

        $mail = $this->service->buildMail(EmailTemplateType::ORDER_CONFIRMATION, $this->organizer());

        $this->assertSame('Merci Marie', $mail->envelope()->subject);
        $this->assertStringContainsString('Bonjour Marie', $mail->render());
    }

    public function test_without_any_event_a_placeholder_event_in_the_organizer_currency_is_used(): void
    {
        $this->eventRepository->shouldReceive('findWhere')->andReturn(collect());
        $this->productRepository->shouldNotReceive('findFirstWhere');
        $this->emailTemplateService->shouldReceive('getTemplateByType')->andReturnNull();

        $mail = $this->service->buildMail(EmailTemplateType::ORDER_CONFIRMATION, $this->organizer());

        $html = $mail->render();
        $this->assertStringContainsString(__('Your event'), $html);
        $this->assertStringContainsString('70.00', $html);
    }

    public function test_the_ticket_email_comes_without_attachments(): void
    {
        $this->eventRepository->shouldReceive('findWhere')->andReturn(collect([$this->event()]));
        $this->productRepository->shouldReceive('findFirstWhere')->andReturn($this->ticket(20));
        $this->emailTemplateService
            ->shouldReceive('getTemplateByType')
            ->with(EmailTemplateType::ATTENDEE_TICKET, 3, null, 7)
            ->andReturnNull();

        $mail = $this->service->buildMail(EmailTemplateType::ATTENDEE_TICKET, $this->organizer());

        $this->assertInstanceOf(AttendeeTicketMail::class, $mail);
        $this->assertSame([], $mail->attachments());
        $this->assertStringContainsString(SampleEmailService::SAMPLE_FIRST_NAME, $mail->render());
    }

    private function organizer(): OrganizerDomainObject
    {
        return (new OrganizerDomainObject())
            ->setId(7)
            ->setAccountId(3)
            ->setName('Sulpace')
            ->setEmail('bonjour@sulpace.ca')
            ->setCurrency('CAD')
            ->setTimezone('America/Toronto');
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId(11)
            ->setAccountId(3)
            ->setOrganizerId(7)
            ->setTitle('Course des Lièvres')
            ->setStartDate('2026-11-07 14:00:00')
            ->setTimezone('America/Toronto')
            ->setCurrency('CAD')
            ->setEventSettings((new EventSettingDomainObject())->setSupportEmail('bonjour@sulpace.ca'));
    }

    private function ticket(float $price): ProductDomainObject
    {
        return (new ProductDomainObject())
            ->setId(5)
            ->setTitle('Billet régulier')
            ->setProductPrices(collect([(new ProductPriceDomainObject())->setId(9)->setPrice($price)]));
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
