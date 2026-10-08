<?php

namespace Tests\Unit\Services\Domain\Mail;

use HiEvents\DomainObjects\Enums\MessageTypeEnum;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Jobs\Event\SendEventEmailJob;
use HiEvents\Jobs\Message\DeleteMessageAttachmentsJob;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\MessageRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\Message\DTO\SendMessageDTO;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use HiEvents\Services\Domain\Mail\SendEventEmailMessagesService;
use Illuminate\Bus\PendingBatch;
use Illuminate\Support\Facades\Bus;
use Mockery as m;
use Symfony\Component\HttpKernel\Log\Logger;
use Tests\TestCase;

class SendEventEmailMessagesServiceTest extends TestCase
{
    private const ATTACHMENTS = [
        ['disk' => 'local', 'path' => 'message-attachments/1/abc.pdf', 'name' => 'programme.pdf'],
    ];

    private OrderRepositoryInterface $orderRepository;
    private AttendeeRepositoryInterface $attendeeRepository;
    private MessageRepositoryInterface $messageRepository;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->attendeeRepository = m::mock(AttendeeRepositoryInterface::class);
        $this->messageRepository = m::mock(MessageRepositoryInterface::class);
        $this->messageRepository->shouldReceive('updateWhere');
    }

    public function testDispatchesJobsIndividuallyWithoutAttachments(): void
    {
        $this->mockOrder();

        $this->createService()->send($this->createDto(MessageTypeEnum::ORDER_OWNER));

        Bus::assertDispatched(
            SendEventEmailJob::class,
            fn(SendEventEmailJob $job) => (new \ReflectionProperty($job, 'locale'))->getValue($job) === 'fr',
        );
        Bus::assertNothingBatched();
    }

    public function testBatchesJobsAndDeletesAttachmentsWhenBatchFinishes(): void
    {
        $this->mockOrder();

        $this->createService()->send($this->createDto(MessageTypeEnum::ORDER_OWNER, self::ATTACHMENTS));

        Bus::assertBatched(function (PendingBatch $batch) {
            if ($batch->jobs->count() !== 1 || !$batch->allowsFailures()) {
                return false;
            }

            foreach ($batch->finallyCallbacks() as $callback) {
                $callback();
            }

            return true;
        });
        Bus::assertDispatched(
            DeleteMessageAttachmentsJob::class,
            fn(DeleteMessageAttachmentsJob $job) => (new \ReflectionProperty($job, 'attachments'))->getValue($job) === self::ATTACHMENTS,
        );
    }

    public function testDeletesAttachmentsImmediatelyWhenThereAreNoRecipients(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn(null);
        $this->attendeeRepository->shouldReceive('findWhere')->andReturn(collect());

        $this->createService()->send($this->createDto(MessageTypeEnum::ALL_ATTENDEES, self::ATTACHMENTS));

        Bus::assertNothingBatched();
        Bus::assertDispatched(DeleteMessageAttachmentsJob::class);
    }

    private function mockOrder(): void
    {
        $order = new OrderDomainObject();
        $order->setId(5);
        $order->setEmail('buyer@example.com');
        $order->setFirstName('Jane');
        $order->setLastName('Doe');
        $order->setLocale('fr');

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
    }

    private function createService(): SendEventEmailMessagesService
    {
        $event = new EventDomainObject();
        $event->setId(1);
        $event->setEventSettings(new EventSettingDomainObject());

        $eventRepository = m::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findById')->andReturn($event);

        return new SendEventEmailMessagesService(
            orderRepository: $this->orderRepository,
            attendeeRepository: $this->attendeeRepository,
            eventRepository: $eventRepository,
            messageRepository: $this->messageRepository,
            userRepository: m::mock(UserRepositoryInterface::class),
            logger: m::mock(Logger::class),
            dispatcher: Bus::getFacadeRoot(),
            brandingService: app(EventEmailBrandingService::class),
        );
    }

    private function createDto(MessageTypeEnum $type, array $attachments = []): SendMessageDTO
    {
        return new SendMessageDTO(
            account_id: 1,
            event_id: 1,
            subject: 'Subject',
            message: 'Message',
            type: $type,
            is_test: false,
            send_copy_to_current_user: false,
            sent_by_user_id: 1,
            order_id: 5,
            id: 10,
            attachments: $attachments,
        );
    }
}
