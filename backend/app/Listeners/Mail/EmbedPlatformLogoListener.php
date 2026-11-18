<?php

namespace HiEvents\Listeners\Mail;

use Illuminate\Mail\Events\MessageSending;

/**
 * The DEHORS wordmark travels inside the email: the clients that block remote images
 * (Outlook, Thunderbird, privacy settings) still show it. Previews keep the web link.
 */
class EmbedPlatformLogoListener
{
    public const CONTENT_NAME = 'billetterie-dehors-wordmark';

    private const LOGO_PATTERN = '#(src=["\'])[^"\']*/logos/billetterie-dehors-wordmark\.png(["\'])#';

    public function handle(MessageSending $event): void
    {
        $email = $event->message;
        $html = $email->getHtmlBody();
        $path = resource_path('mail/billetterie-dehors-wordmark.png');

        if (!is_string($html) || !is_file($path) || !preg_match(self::LOGO_PATTERN, $html)) {
            return;
        }

        $email->html(preg_replace(self::LOGO_PATTERN, '${1}cid:' . self::CONTENT_NAME . '${2}', $html));
        $email->embedFromPath($path, self::CONTENT_NAME, 'image/png');
    }
}
