<?php

namespace Tests\Unit\Services\Application\Handlers\EmailTemplate;

use HiEvents\DomainObjects\EmailTemplateDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\Exceptions\EmailTemplateValidationException;
use HiEvents\Repository\Interfaces\EmailTemplateRepositoryInterface;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\UpsertEmailCustomizationDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\UpsertEmailCustomizationHandler;
use HiEvents\Services\Domain\Email\EmailTemplateService;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;
use Mockery as m;
use Mockery\MockInterface;
use Tests\TestCase;

class UpsertEmailCustomizationHandlerTest extends TestCase
{
    private EmailTemplateRepositoryInterface&MockInterface $repository;
    private UpsertEmailCustomizationHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = m::mock(EmailTemplateRepositoryInterface::class);
        $this->handler = new UpsertEmailCustomizationHandler(
            $this->repository,
            app(EmailTemplateService::class),
            app(HtmlPurifierService::class),
        );
    }

    public function testCreatesTheOrganizerVersionWithACleanMessage(): void
    {
        $this->repository->shouldReceive('findFirstWhere')->once()->andReturnNull();
        $this->repository->shouldReceive('create')
            ->once()
            ->withArgs(fn(array $attributes) => $attributes['template_type'] === 'order_cancelled'
                && $attributes['organizer_id'] === 7
                && $attributes['event_id'] === null
                && $attributes['subject'] === 'Annulation : {{ event.title }}'
                && !str_contains($attributes['body'], 'script')
                && str_contains($attributes['body'], 'Désolés'))
            ->andReturn(new EmailTemplateDomainObject());

        $this->assertNotNull($this->handler->handle(
            $this->dto(EmailTemplateType::ORDER_CANCELLED, "Annulation :\n {{ event.title }}", '<p>Désolés<script>alert(1)</script></p>'),
        ));
    }

    public function testUpdatesTheExistingVersion(): void
    {
        $this->repository->shouldReceive('findFirstWhere')->andReturn((new EmailTemplateDomainObject())->setId(4));
        $this->repository->shouldReceive('updateFromArray')
            ->once()
            ->withArgs(fn(int $id, array $attributes) => $id === 4 && $attributes['subject'] === '' && $attributes['body'] === '<p>Merci</p>')
            ->andReturn(new EmailTemplateDomainObject());

        $this->assertNotNull($this->handler->handle($this->dto(EmailTemplateType::WAITLIST_JOINED, '', '<p>Merci</p>')));
    }

    public function testEmptyFieldsGoBackToTheDefaultEmail(): void
    {
        $this->repository->shouldReceive('findFirstWhere')->andReturn((new EmailTemplateDomainObject())->setId(4));
        $this->repository->shouldReceive('deleteById')->once()->with(4);
        $this->repository->shouldNotReceive('create');

        $this->assertNull($this->handler->handle($this->dto(EmailTemplateType::ORDER_REFUNDED, ' ', '<p><br></p>')));
    }

    public function testRejectsBadlyWrittenAutomaticInfo(): void
    {
        $this->repository->shouldNotReceive('create');

        try {
            $this->handler->handle($this->dto(EmailTemplateType::ORDER_REFUNDED, 'Ok', '<p>{% if %}</p>'));
            $this->fail('The message should be refused');
        } catch (EmailTemplateValidationException $exception) {
            $this->assertArrayHasKey('message', $exception->validationErrors);
        }
    }

    public function testTheFullyEditedEmailsAreRefused(): void
    {
        $this->expectException(EmailTemplateValidationException::class);

        $this->handler->handle($this->dto(EmailTemplateType::ORDER_CONFIRMATION, 'Merci', '<p>Merci</p>'));
    }

    private function dto(EmailTemplateType $type, ?string $subject, ?string $message): UpsertEmailCustomizationDTO
    {
        return new UpsertEmailCustomizationDTO(accountId: 3, organizerId: 7, type: $type, subject: $subject, message: $message);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
