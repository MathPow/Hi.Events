<?php

declare(strict_types=1);

namespace HiEvents\Mail\EmailTemplate;

use HiEvents\Mail\BaseMail;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * An automatic email already rendered for the preview, sent as is to its author.
 */
class TestEmailMail extends BaseMail
{
    public function __construct(
        private readonly string $emailSubject,
        private readonly string $renderedHtml,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->emailSubject,
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->renderedHtml,
        );
    }
}
