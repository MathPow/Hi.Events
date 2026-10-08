<?php

namespace Tests\Unit\Services\Application\Handlers\Message;

use HiEvents\DomainObjects\MessageDomainObject;
use HiEvents\DomainObjects\Status\MessageStatus;
use HiEvents\Jobs\Message\DeleteMessageAttachmentsJob;
use HiEvents\Repository\Interfaces\MessageRepositoryInterface;
use HiEvents\Services\Application\Handlers\Message\CancelMessageHandler;
use Illuminate\Support\Facades\Bus;
use Mockery as m;
use Tests\TestCase;

class CancelMessageHandlerTest extends TestCase
{
    public function testDeletesAttachmentsWhenScheduledMessageIsCancelled(): void
    {
        Bus::fake();

        $attachments = [['disk' => 'local', 'path' => 'message-attachments/1/abc.pdf', 'name' => 'abc.pdf']];

        $message = new MessageDomainObject();
        $message->setId(10);
        $message->setStatus(MessageStatus::SCHEDULED->name);
        $message->setSendData(['account_id' => 1, 'attachments' => $attachments]);

        $repository = m::mock(MessageRepositoryInterface::class);
        $repository->shouldReceive('findFirstWhere')->andReturn($message);
        $repository->shouldReceive('updateWhere')->andReturn(1);
        $repository->shouldReceive('findFirst')->with(10)->andReturn($message);

        (new CancelMessageHandler($repository))->handle(10, 1);

        Bus::assertDispatched(DeleteMessageAttachmentsJob::class);
    }

    public function testDoesNotDispatchCleanupWithoutAttachments(): void
    {
        Bus::fake();

        $message = new MessageDomainObject();
        $message->setId(10);
        $message->setStatus(MessageStatus::SCHEDULED->name);
        $message->setSendData(['account_id' => 1]);

        $repository = m::mock(MessageRepositoryInterface::class);
        $repository->shouldReceive('findFirstWhere')->andReturn($message);
        $repository->shouldReceive('updateWhere')->andReturn(1);
        $repository->shouldReceive('findFirst')->with(10)->andReturn($message);

        (new CancelMessageHandler($repository))->handle(10, 1);

        Bus::assertNotDispatched(DeleteMessageAttachmentsJob::class);
    }
}
