<?php

namespace Tests\Unit\Mail\Organizer;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Mail\Organizer\OrderSummaryForOrganizer;
use Illuminate\Mail\Transport\ArrayTransport;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class OrderSummaryForOrganizerTest extends TestCase
{
    public function test_it_is_sent_in_the_platform_language_with_dehors_branding(): void
    {
        config(['app.locale' => 'fr', 'app.frontend_url' => 'https://billets.example.com']);
        app()->setLocale('fr');

        $email = $this->send(new OrderSummaryForOrganizer($this->order(), $this->event()));
        $html = $email->getHtmlBody();

        $this->assertSame('Nouvelle commande de 45,00 $ pour Backyard Boréal 🎉', $this->normalizeSpaces($email->getSubject()));

        $this->assertStringContainsString('Vous avez reçu une nouvelle commande', $html);
        $this->assertStringContainsString('Backyard Boréal</strong>', $html);
        $this->assertStringContainsString('Complétée', $html);
        $this->assertStringContainsString('https://billets.example.com/logos/dehors-billetterie-clair.png', $html);
        $this->assertStringContainsString('Propulsé par', $html);
        $this->assertStringNotContainsString('hi-events-stacked', $html);
        $this->assertStringNotContainsString('received a new order', $html);
    }

    private function normalizeSpaces(string $text): string
    {
        return str_replace(["\u{00A0}", "\u{202F}"], ' ', $text);
    }

    private function send(OrderSummaryForOrganizer $mail): Email
    {
        $mailer = app('mailer');
        $mailer->to('organisateur@example.com')->send($mail);

        /** @var ArrayTransport $transport */
        $transport = $mailer->getSymfonyTransport();

        /** @var Email $email */
        $email = $transport->messages()->last()->getOriginalMessage();

        $transport->flush();

        return $email;
    }

    private function order(): OrderDomainObject
    {
        return (new OrderDomainObject)
            ->setId(7)
            ->setEventId(3)
            ->setShortId('o_123')
            ->setPublicId('O-AAAAAAA')
            ->setStatus(OrderStatus::COMPLETED->name)
            ->setCurrency('CAD')
            ->setTotalGross(45.0)
            ->setEmail('alex@example.com')
            ->setFirstName('Alex')
            ->setLastName('Tremblay');
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject)
            ->setId(3)
            ->setTitle('Backyard Boréal')
            ->setCurrency('CAD');
    }
}
