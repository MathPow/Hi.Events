<?php

namespace Tests\Unit\Mail\Attendee;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Mail\Attendee\AttendeeTicketMail;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Collection;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class AttendeeTicketMailTest extends TestCase
{
    public function test_it_embeds_a_qr_code_for_the_ticket(): void
    {
        $email = $this->send($this->buildMail());

        // Inline images are referenced by content id, not by a link back to the site - remote
        // images are blocked by default in most mail clients.
        $this->assertStringContainsString('src="cid:', $email->getHtmlBody());
        $this->assertStringContainsString('A-AAAAAAA', $email->getHtmlBody());
        $this->assertSame(1, $this->inlineImageCount($email));
    }

    public function test_it_embeds_a_qr_code_for_every_ticket_sent_to_the_same_address(): void
    {
        $email = $this->send($this->buildMail(additionalAttendees: collect([
            $this->attendee('A-BBBBBBB', 'Robin'),
            $this->attendee('A-CCCCCCC', 'Sam'),
        ])));

        $html = $email->getHtmlBody();

        $this->assertSame(3, $this->inlineImageCount($email));
        $this->assertStringContainsString('A-AAAAAAA', $html);
        $this->assertStringContainsString('A-BBBBBBB', $html);
        $this->assertStringContainsString('A-CCCCCCC', $html);
    }

    public function test_the_embedded_qr_codes_are_readable_pngs(): void
    {
        $email = $this->send($this->buildMail());

        $qrCode = collect($email->getAttachments())
            ->first(static fn($part) => str_contains($part->asDebugString(), 'A-AAAAAAA.png'));

        $this->assertNotNull($qrCode);

        $info = getimagesizefromstring($qrCode->getBody());

        $this->assertNotFalse($info);
        $this->assertSame(IMAGETYPE_PNG, $info[2]);
    }

    public function test_it_attaches_the_tickets_as_a_pdf(): void
    {
        $filenames = $this->attachmentFilenames($this->send($this->buildMail()));

        $this->assertContains('summer-fest-ticket.pdf', $filenames);
        $this->assertContains('event.ics', $filenames);
    }

    public function test_the_pdf_is_named_for_the_number_of_tickets_it_holds(): void
    {
        $email = $this->send($this->buildMail(additionalAttendees: collect([
            $this->attendee('A-BBBBBBB', 'Robin'),
        ])));

        $this->assertContains('summer-fest-tickets.pdf', $this->attachmentFilenames($email));
    }

    public function test_the_attached_pdf_is_a_readable_pdf(): void
    {
        $email = $this->send($this->buildMail());

        $pdf = collect($email->getAttachments())
            ->first(static fn($part) => str_contains($part->asDebugString(), 'summer-fest-ticket.pdf'));

        $this->assertNotNull($pdf);
        $this->assertStringStartsWith('%PDF-', $pdf->getBody());
    }

    public function test_the_subject_names_the_event(): void
    {
        $this->assertStringContainsString('Summer Fest', $this->buildMail()->envelope()->subject);
    }

    private function send(AttendeeTicketMail $mail): Email
    {
        $mailer = app('mailer');
        $mailer->to('alex@example.com')->send($mail);

        /** @var ArrayTransport $transport */
        $transport = $mailer->getSymfonyTransport();

        /** @var Email $email */
        $email = $transport->messages()->last()->getOriginalMessage();

        $transport->flush();

        return $email;
    }

    private function inlineImageCount(Email $email): int
    {
        return collect($email->getAttachments())
            ->filter(static fn($part) => str_contains($part->asDebugString(), 'image/png'))
            ->count();
    }

    /**
     * @return array<int, string>
     */
    private function attachmentFilenames(Email $email): array
    {
        return collect($email->getAttachments())
            ->map(static fn($part) => $part->getPreparedHeaders()->getHeaderParameter('content-disposition', 'filename'))
            ->filter()
            ->values()
            ->all();
    }

    private function buildMail(?Collection $additionalAttendees = null): AttendeeTicketMail
    {
        return new AttendeeTicketMail(
            order: $this->order(),
            attendee: $this->attendee('A-AAAAAAA', 'Alex'),
            event: $this->event(),
            eventSettings: $this->eventSettings(),
            organizer: $this->organizer(),
            additionalAttendees: $additionalAttendees,
        );
    }

    private function order(): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId(1)
            ->setEventId(1)
            ->setShortId('o_123')
            ->setPublicId('O-AAAAAAA')
            ->setStatus(OrderStatus::COMPLETED->name)
            ->setCurrency('CAD')
            ->setEmail('alex@example.com')
            ->setFirstName('Alex')
            ->setLastName('Tremblay')
            ->setOrderItems(collect([
                (new OrderItemDomainObject())
                    ->setId(1)
                    ->setOrderId(1)
                    ->setProductId(1)
                    ->setProductPriceId(1)
                    ->setQuantity(1)
                    ->setItemName('General Admission')
                    ->setPrice(25.0),
            ]));
    }

    private function attendee(string $publicId, string $firstName): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())
            ->setId(1)
            ->setEventId(1)
            ->setOrderId(1)
            ->setProductId(1)
            ->setProductPriceId(1)
            ->setPublicId($publicId)
            ->setShortId('a_' . strtolower($publicId))
            ->setFirstName($firstName)
            ->setLastName('Tremblay')
            ->setEmail('alex@example.com')
            ->setLocale('en')
            ->setStatus('ACTIVE');
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId(1)
            ->setAccountId(1)
            ->setOrganizerId(1)
            ->setTitle('Summer Fest')
            ->setCurrency('CAD')
            ->setTimezone('America/Toronto')
            ->setStartDate('2026-09-01 18:00:00')
            ->setEndDate('2026-09-01 23:00:00');
    }

    private function eventSettings(): EventSettingDomainObject
    {
        return (new EventSettingDomainObject())
            ->setId(1)
            ->setEventId(1)
            ->setSupportEmail('support@example.com');
    }

    private function organizer(): OrganizerDomainObject
    {
        return (new OrganizerDomainObject())
            ->setId(1)
            ->setAccountId(1)
            ->setName('DEHORS')
            ->setEmail('organizer@example.com');
    }
}
