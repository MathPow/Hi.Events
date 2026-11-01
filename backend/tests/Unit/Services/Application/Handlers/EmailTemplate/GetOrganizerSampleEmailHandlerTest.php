<?php

namespace Tests\Unit\Services\Application\Handlers\EmailTemplate;

use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Mail\Order\OrderSummary;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\OrganizerSampleEmailDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\GetOrganizerSampleEmailHandler;
use HiEvents\Services\Domain\Email\SampleEmailService;
use Illuminate\Mail\Mailables\Envelope;
use Mockery as m;
use Tests\TestCase;

class GetOrganizerSampleEmailHandlerTest extends TestCase
{
    public function test_returns_the_subject_and_the_html_of_the_sample_email(): void
    {
        $organizer = (new OrganizerDomainObject())->setId(7)->setAccountId(3);
        $organizerRepository = m::mock(OrganizerRepositoryInterface::class);
        $organizerRepository->shouldReceive('findFirstWhere')
            ->once()
            ->with(['id' => 7, 'account_id' => 3])
            ->andReturn($organizer);

        $mail = m::mock(OrderSummary::class);
        $mail->shouldReceive('locale')->andReturnSelf();
        $mail->shouldReceive('envelope')->andReturn(new Envelope(subject: 'Votre commande est confirmée'));
        $mail->shouldReceive('render')->andReturn('<html>Merci</html>');

        $sampleEmailService = m::mock(SampleEmailService::class);
        $sampleEmailService->shouldReceive('buildMail')
            ->once()
            ->with(EmailTemplateType::ORDER_CONFIRMATION, $organizer)
            ->andReturn($mail);

        $result = (new GetOrganizerSampleEmailHandler($organizerRepository, $sampleEmailService))
            ->handle(new OrganizerSampleEmailDTO(organizerId: 7, accountId: 3, type: EmailTemplateType::ORDER_CONFIRMATION));

        $this->assertSame('Votre commande est confirmée', $result->subject);
        $this->assertSame('<html>Merci</html>', $result->html);
    }

    public function test_an_organizer_of_another_account_is_not_found(): void
    {
        $organizerRepository = m::mock(OrganizerRepositoryInterface::class);
        $organizerRepository->shouldReceive('findFirstWhere')->andReturnNull();
        $sampleEmailService = m::mock(SampleEmailService::class);
        $sampleEmailService->shouldNotReceive('buildMail');

        $this->expectException(ResourceNotFoundException::class);

        (new GetOrganizerSampleEmailHandler($organizerRepository, $sampleEmailService))
            ->handle(new OrganizerSampleEmailDTO(organizerId: 7, accountId: 99, type: EmailTemplateType::ATTENDEE_TICKET));
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
