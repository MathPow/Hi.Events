<?php

namespace HiEvents\Services\Domain\Event\RouteFile;

use HiEvents\Helper\StringHelper;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\HeaderUtils;

/**
 * The name a downloaded course is saved under, from its label: « 10 km » gives « 10 km.gpx ».
 * Accents are kept (filename*), with a plain ASCII name for older clients.
 */
class RouteFileDownloadName
{
    private const MAX_LENGTH = 100;

    private const TRIMMED = " .-";

    public function filename(string $label): string
    {
        $name = trim(StringHelper::stripControlCharacters($label));
        $name = preg_replace('/\.gpx$/i', '', $name) ?? '';
        $name = preg_replace('/[\/\\\\:*?"<>|]+/u', '-', $name) ?? '';
        $name = preg_replace('/\s+/u', ' ', $name) ?? '';
        $name = trim(Str::limit(trim($name, self::TRIMMED), self::MAX_LENGTH, ''), self::TRIMMED);

        return ($name === '' ? __('Route') : $name) . '.gpx';
    }

    public function asciiFilename(string $label): string
    {
        $name = Str::ascii($this->filename($label));
        $name = preg_replace('/[^\x20-\x7e]|[%"\\\\\/]/', '', $name) ?? '';
        $name = trim(preg_replace('/\s+/', ' ', $name) ?? '', self::TRIMMED);

        return strtolower($name) === 'gpx' || $name === '' ? 'route.gpx' : $name;
    }

    public function contentDisposition(string $label): string
    {
        return HeaderUtils::makeDisposition(
            HeaderUtils::DISPOSITION_ATTACHMENT,
            $this->filename($label),
            $this->asciiFilename($label),
        );
    }
}
