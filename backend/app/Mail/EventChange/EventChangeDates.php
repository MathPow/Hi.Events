<?php

namespace HiEvents\Mail\EventChange;

use Carbon\Carbon;

/**
 * « Samedi 21 novembre 2026 09:00 (HNE) »: a date of the event in its timezone and in the email's language.
 */
trait EventChangeDates
{
    private function formatEventDate(?string $utcDate, ?string $timezone, bool $capitalize = true): ?string
    {
        if ($utcDate === null) {
            return null;
        }

        $text = Carbon::parse($utcDate, 'UTC')
            ->setTimezone($timezone ?: 'UTC')
            ->locale(app()->getLocale())
            ->isoFormat('LLLL (z)');

        return $capitalize ? mb_strtoupper(mb_substr($text, 0, 1)) . mb_substr($text, 1) : $text;
    }

    private function messageHtml(string $message): string
    {
        return nl2br(e(trim($message)), false);
    }
}
