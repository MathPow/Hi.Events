<?php

namespace Tests\Unit\Jobs\Event;

use HiEvents\DomainObjects\Enums\MessageTypeEnum;
use HiEvents\Jobs\Event\SendEventEmailJob;
use HiEvents\Mail\Event\EventMessage;
use HiEvents\Repository\Interfaces\OutgoingMessageRepositoryInterface;
use HiEvents\Services\Application\Handlers\Message\DTO\SendMessageDTO;
use Illuminate\Mail\Mailer;
use Illuminate\Mail\PendingMail;
use Mockery as m;
use Tests\TestCase;

class SendEventEmailJobTest extends TestCase
{
    public function testSendsMailSynchronouslySoTheBatchOnlyFinishesOnceDelivered(): void
    {
        $eventMessage = m::mock(EventMessage::class);

        $pendingMail = m::mock(PendingMail::class);
        $pendingMail->shouldReceive('locale')->once()->with('fr')->andReturnSelf();
        $pendingMail->shouldReceive('sendNow')->once()->with($eventMessage);
        $pendingMail->shouldNotReceive('send');

        $mailer = m::mock(Mailer::class);
        $mailer->shouldReceive('to')->with('jane@example.com', 'Jane Doe')->andReturn($pendingMail);

        $outgoingMessageRepository = m::mock(OutgoingMessageRepositoryInterface::class);
        $outgoingMessageRepository->shouldReceive('create')->once();

        $job = new SendEventEmailJob(
            email: 'jane@example.com',
            toName: 'Jane Doe',
            eventMessage: $eventMessage,
            messageData: new SendMessageDTO(
                account_id: 1,
                event_id: 1,
                subject: 'Subject',
                message: 'Message',
                type: MessageTypeEnum::ALL_ATTENDEES,
                is_test: false,
                send_copy_to_current_user: false,
                sent_by_user_id: 1,
                id: 10,
            ),
            locale: 'fr',
        );

        $job->handle($mailer, $outgoingMessageRepository);
    }
}
