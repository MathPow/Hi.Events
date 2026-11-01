<?php

namespace Tests\Unit\Services\Domain\Mail;

use HiEvents\DomainObjects\EmailTemplateDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\Interfaces\EmailTemplateRepositoryInterface;
use HiEvents\Services\Domain\Mail\ParticipantEmailService;
use HiEvents\Services\Infrastructure\Email\LiquidTemplateRenderer;
use Mockery as m;
use Mockery\MockInterface;
use Psr\Log\NullLogger;
use Tests\TestCase;

class ParticipantEmailServiceTest extends TestCase
{
    private EmailTemplateRepositoryInterface&MockInterface $templateRepository;
    private ParticipantEmailService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->templateRepository = m::mock(EmailTemplateRepositoryInterface::class);
        $this->service = new ParticipantEmailService($this->templateRepository, new LiquidTemplateRenderer(), new NullLogger());
    }

    public function testRendersTheSubjectAndTheMessageWithTheAutomaticInfo(): void
    {
        $this->templateRepository->shouldReceive('findByTypeWithFallback')
            ->once()
            ->with(EmailTemplateType::WAITLIST_OFFER, 3, 11, 7)
            ->andReturn($this->template('Une place pour {{ event.title }} !', '<p>Vite, {{ participant.first_name }} !</p>'));

        $result = $this->service->customize(EmailTemplateType::WAITLIST_OFFER, $this->event(), $this->organizer(), 'Marie', 'Tremblay');

        $this->assertSame('Une place pour Backyard Boréal !', $result->subject);
        $this->assertSame('<p>Vite, Marie !</p>', $result->message);
    }

    public function testEscapesTheNamesInTheMessageButNotInTheSubject(): void
    {
        $this->templateRepository->shouldReceive('findByTypeWithFallback')
            ->andReturn($this->template('Bonjour {{ participant.first_name }}', '<p>Bonjour {{ participant.first_name }}</p>'));

        $result = $this->service->customize(EmailTemplateType::ORDER_CANCELLED, $this->event(), $this->organizer(), '<b>Jo</b>', null);

        $this->assertSame('Bonjour Jo', $result->subject);
        $this->assertSame('<p>Bonjour &lt;b&gt;Jo&lt;/b&gt;</p>', $result->message);
    }

    public function testAnEmptySubjectOrMessageKeepsTheDefault(): void
    {
        $this->templateRepository->shouldReceive('findByTypeWithFallback')->andReturn($this->template('  ', '<p> </p>'));

        $result = $this->service->customize(EmailTemplateType::ORDER_REFUNDED, $this->event(), $this->organizer());

        $this->assertNull($result->subject);
        $this->assertNull($result->message);
    }

    public function testABadlyWrittenTemplateFallsBackToTheDefault(): void
    {
        $this->templateRepository->shouldReceive('findByTypeWithFallback')->andReturn($this->template('{% if %}', '<p>{{ event.title </p>'));

        $result = $this->service->customize(EmailTemplateType::ORDER_REFUNDED, $this->event(), $this->organizer());

        $this->assertNull($result->subject);
    }

    public function testTheFullyEditedEmailsAreLeftToTheirTemplates(): void
    {
        $this->templateRepository->shouldNotReceive('findByTypeWithFallback');

        $result = $this->service->customize(EmailTemplateType::ORDER_CONFIRMATION, $this->event(), $this->organizer());

        $this->assertNull($result->subject);
        $this->assertNull($result->message);
    }

    private function template(string $subject, string $body): EmailTemplateDomainObject
    {
        return (new EmailTemplateDomainObject())->setId(1)->setSubject($subject)->setBody($body);
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId(11)
            ->setTitle('Backyard Boréal')
            ->setTimezone('America/Toronto')
            ->setStartDate('2030-10-26 12:00:00')
            ->setEventSettings(new EventSettingDomainObject());
    }

    private function organizer(): OrganizerDomainObject
    {
        return (new OrganizerDomainObject())->setId(7)->setAccountId(3)->setName('Boréal')->setEmail('bonjour@boreal.ca');
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
