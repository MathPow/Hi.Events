<?php

namespace Tests\Unit\Mail\Event;

use HiEvents\DomainObjects\Enums\MessageTypeEnum;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Mail\Event\EventMessage;
use HiEvents\Services\Application\Handlers\Message\DTO\SendMessageDTO;
use Tests\TestCase;

class EventMessageTest extends TestCase
{
    public function testAttachesStoredPdfs(): void
    {
        $mail = new EventMessage(
            event: new EventDomainObject(),
            eventSettings: new EventSettingDomainObject(),
            messageData: new SendMessageDTO(
                account_id: 1,
                event_id: 1,
                subject: 'Subject',
                message: 'Message',
                type: MessageTypeEnum::ALL_ATTENDEES,
                is_test: false,
                send_copy_to_current_user: false,
                sent_by_user_id: 1,
                attachments: [
                    ['disk' => 'local', 'path' => 'message-attachments/1/abc.pdf', 'name' => 'programme.pdf'],
                ],
            ),
        );

        $attachments = $mail->attachments();

        $this->assertCount(1, $attachments);
        $this->assertSame('programme.pdf', $attachments[0]->as);
        $this->assertSame('application/pdf', $attachments[0]->mime);
    }

    public function testHasNoAttachmentsByDefault(): void
    {
        $mail = new EventMessage(
            event: new EventDomainObject(),
            eventSettings: new EventSettingDomainObject(),
            messageData: new SendMessageDTO(
                account_id: 1,
                event_id: 1,
                subject: 'Subject',
                message: 'Message',
                type: MessageTypeEnum::ALL_ATTENDEES,
                is_test: false,
                send_copy_to_current_user: false,
                sent_by_user_id: 1,
            ),
        );

        $this->assertSame([], $mail->attachments());
    }
}
