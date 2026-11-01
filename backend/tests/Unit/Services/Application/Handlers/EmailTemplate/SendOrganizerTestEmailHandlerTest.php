<?php

namespace Tests\Unit\Services\Application\Handlers\EmailTemplate;

use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Mail\EmailTemplate\TestEmailMail;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\OrganizerSampleEmailDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\RenderedSampleEmailDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\SendOrganizerTestEmailDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\GetOrganizerSampleEmailHandler;
use HiEvents\Services\Application\Handlers\EmailTemplate\SendOrganizerTestEmailHandler;
use Illuminate\Mail\Mailer;
use Illuminate\Mail\PendingMail;
use Mockery as m;
use Tests\TestCase;

class SendOrganizerTestEmailHandlerTest extends TestCase
{
    public function test_sends_the_previewed_email_to_the_person_asking(): void
    {
        $sampleHandler = m::mock(GetOrganizerSampleEmailHandler::class);
        $sampleHandler->shouldReceive('handle')
            ->once()
            ->withArgs(fn(OrganizerSampleEmailDTO $dto) => $dto->organizerId === 7
                && $dto->accountId === 3
                && $dto->type === EmailTemplateType::ATTENDEE_TICKET)
            ->andReturn(new RenderedSampleEmailDTO(subject: 'Votre billet', html: '<html>Billet</html>'));

        $userRepository = m::mock(UserRepositoryInterface::class);
        $userRepository->shouldReceive('findById')->once()->with(12)
            ->andReturn((new UserDomainObject())->setId(12)->setEmail('jules@sulpace.ca'));

        $pendingMail = m::mock(PendingMail::class);
        $pendingMail->shouldReceive('send')
            ->once()
            ->withArgs(function (TestEmailMail $mail) {
                return $mail->envelope()->subject === __('[Test] :subject', ['subject' => 'Votre billet'])
                    && $mail->content()->htmlString === '<html>Billet</html>';
            });

        $mailer = m::mock(Mailer::class);
        $mailer->shouldReceive('to')->once()->with('jules@sulpace.ca')->andReturn($pendingMail);

        $sentTo = (new SendOrganizerTestEmailHandler($sampleHandler, $userRepository, $mailer))
            ->handle(new SendOrganizerTestEmailDTO(
                organizerId: 7,
                accountId: 3,
                userId: 12,
                type: EmailTemplateType::ATTENDEE_TICKET,
            ));

        $this->assertSame('jules@sulpace.ca', $sentTo);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
