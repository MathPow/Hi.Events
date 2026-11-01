<?php

namespace Tests\Unit\Mail\Event;

use HiEvents\DomainObjects\Enums\MessageTypeEnum;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Mail\Event\EventMessage;
use HiEvents\Services\Application\Handlers\Message\DTO\SendMessageDTO;
use HiEvents\Services\Domain\Mail\DTO\EventEmailBrandingDTO;
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
            branding: $this->branding(),
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
            branding: $this->branding(),
        );

        $this->assertSame([], $mail->attachments());
    }

    public function testRendersWithOrganizerBranding(): void
    {
        $event = new EventDomainObject();
        $event->setTitle('Backyard Boréal');
        $event->setTimezone('America/Toronto');
        $event->setStartDate('2026-10-24 12:00:00');

        $eventSettings = new EventSettingDomainObject();
        $eventSettings->setSupportEmail('info@example.com');
        $eventSettings->setEmailFooterMessage('<p>Footer from organizer</p>');

        $mail = new EventMessage(
            event: $event,
            eventSettings: $eventSettings,
            messageData: new SendMessageDTO(
                account_id: 1,
                event_id: 1,
                subject: 'Guide du participant',
                message: '<p>Bonjour les coureurs</p>',
                type: MessageTypeEnum::ALL_ATTENDEES,
                is_test: false,
                send_copy_to_current_user: false,
                sent_by_user_id: 1,
            ),
            branding: $this->branding(),
        );

        $html = $mail->render();

        $this->assertStringContainsString('Bonjour les coureurs', $html);
        $this->assertStringContainsString('Footer from organizer', $html);
        $this->assertStringContainsString('background-color: #e8f3ff', $html);
        $this->assertStringContainsString('https://example.com/storage/logo.jpg', $html);
        $this->assertStringContainsString('https://example.com/storage/cover.png', $html);
        $this->assertStringContainsString('BACKYARD BORÉAL', mb_strtoupper($html));
        $this->assertStringContainsString('Samedi 24 octobre', $html);
        $this->assertStringContainsString('https://hi.events', $html);
        $this->assertStringContainsString('dehorsqc.com', $html);
    }

    private function branding(): EventEmailBrandingDTO
    {
        return new EventEmailBrandingDTO(
            accentColor: '#1d6fd8',
            accentSoftColor: '#e8f3ff',
            accentDeepColor: '#1f4f8f',
            accentTextColor: '#fffcf8',
            organizerName: 'Boréal',
            organizerLogoUrl: 'https://example.com/storage/logo.jpg',
            eventTitle: 'Backyard Boréal',
            eventUrl: 'https://billets.example.com/event/1/backyard',
            eventCoverUrl: 'https://example.com/storage/cover.png',
            dateLine: 'Samedi 24 octobre · 08:00 → 16:00',
            timezoneLine: 'Heure de l’Est (HAE)',
            placeLine: 'Mont Orford',
            addressLine: null,
            supportEmail: 'info@example.com',
            assetsUrl: 'https://billets.example.com',
            platformLogoUrl: 'https://billets.example.com/logos/dehors-billetterie-clair.png',
            platformUrl: 'https://example.com',
        );
    }
}
