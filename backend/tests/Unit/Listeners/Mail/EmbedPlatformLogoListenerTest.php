<?php

namespace Tests\Unit\Listeners\Mail;

use HiEvents\Listeners\Mail\EmbedPlatformLogoListener;
use Illuminate\Mail\Events\MessageSending;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class EmbedPlatformLogoListenerTest extends TestCase
{
    public function testTheWordmarkIsEmbeddedAndTheLinkPointsToIt(): void
    {
        $email = (new Email())
            ->from('billets@example.com')
            ->to('org@example.com')
            ->subject('Order')
            ->html('<p><img src="https://billets.example.com/logos/billetterie-dehors-wordmark.png" class="logo" alt="DEHORS"></p>');

        (new EmbedPlatformLogoListener())->handle(new MessageSending($email));

        $this->assertStringContainsString('src="cid:billetterie-dehors-wordmark"', $email->getHtmlBody());
        $this->assertStringNotContainsString('https://billets.example.com/logos', $email->getHtmlBody());

        $attachments = $email->getAttachments();
        $this->assertCount(1, $attachments);
        $this->assertSame('inline', $attachments[0]->getDisposition());
        $this->assertSame('image/png', $attachments[0]->getMediaType() . '/' . $attachments[0]->getMediaSubtype());

        $raw = $email->toString();
        $this->assertStringContainsString('Content-ID:', $raw);
        $this->assertStringNotContainsString('src="cid:billetterie-dehors-wordmark"', $raw);
    }

    public function testTheListenerIsRegistered(): void
    {
        $listeners = collect($this->app['events']->getRawListeners()[MessageSending::class] ?? [])
            ->map(fn($listener) => is_array($listener) ? $listener[0] : $listener);

        $this->assertTrue($listeners->contains(fn($listener) => str_starts_with((string)$listener, EmbedPlatformLogoListener::class)));
    }

    public function testAnEmailWithoutTheWordmarkIsLeftAlone(): void
    {
        $html = '<p><img src="https://cdn.example.com/organizer-logo.png"></p>';
        $email = (new Email())
            ->from('billets@example.com')
            ->to('org@example.com')
            ->subject('Message')
            ->html($html);

        (new EmbedPlatformLogoListener())->handle(new MessageSending($email));

        $this->assertSame($html, $email->getHtmlBody());
        $this->assertCount(0, $email->getAttachments());
    }
}
