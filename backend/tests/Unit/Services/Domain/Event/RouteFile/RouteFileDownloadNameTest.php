<?php

namespace Tests\Unit\Services\Domain\Event\RouteFile;

use HiEvents\Services\Domain\Event\RouteFile\RouteFileDownloadName;
use Tests\TestCase;

class RouteFileDownloadNameTest extends TestCase
{
    private RouteFileDownloadName $downloadName;

    protected function setUp(): void
    {
        parent::setUp();

        $this->downloadName = new RouteFileDownloadName();
    }

    public function test_the_label_becomes_the_file_name(): void
    {
        $this->assertSame('10 km.gpx', $this->downloadName->filename('10 km'));
        $this->assertSame('attachment; filename="10 km.gpx"', $this->downloadName->contentDisposition('10 km'));
    }

    public function test_accents_are_kept_in_filename_star_with_an_ascii_fallback(): void
    {
        $header = $this->downloadName->contentDisposition('Boucle du lac — Sainte-Agathe-des-Monts');

        $this->assertSame('Boucle du lac — Sainte-Agathe-des-Monts.gpx', $this->downloadName->filename('Boucle du lac — Sainte-Agathe-des-Monts'));
        $this->assertStringContainsString('filename="Boucle du lac - Sainte-Agathe-des-Monts.gpx"', $header);
        $this->assertStringContainsString(
            "filename*=utf-8''" . rawurlencode('Boucle du lac — Sainte-Agathe-des-Monts.gpx'),
            $header,
        );
    }

    public function test_path_separators_quotes_and_reserved_characters_are_replaced(): void
    {
        $this->assertSame('etc-passwd.gpx', $this->downloadName->filename('../../etc/passwd'));
        $this->assertSame('21 km -élite- - 2026.gpx', $this->downloadName->filename('21 km "élite" \\ 2026'));
        $this->assertSame('a-b-c.gpx', $this->downloadName->filename('a:b*?<>|c'));
    }

    public function test_header_injection_characters_are_removed(): void
    {
        $header = $this->downloadName->contentDisposition("10 km\r\nSet-Cookie: session=1");

        $this->assertStringNotContainsString("\r", $header);
        $this->assertStringNotContainsString("\n", $header);
        $this->assertStringContainsString('filename="10 kmSet-Cookie- session=1.gpx"', $header);
    }

    public function test_the_ascii_fallback_never_holds_a_percent_or_non_ascii_character(): void
    {
        $fallback = $this->downloadName->asciiFilename('100 % trail 🏃 Québec');

        $this->assertMatchesRegularExpression('/^[\x20-\x7e]+$/', $fallback);
        $this->assertStringNotContainsString('%', $fallback);
        $this->assertStringEndsWith('.gpx', $fallback);
    }

    public function test_a_label_already_ending_in_gpx_is_not_doubled(): void
    {
        $this->assertSame('Parcours 5 km.gpx', $this->downloadName->filename('Parcours 5 km.GPX'));
    }

    public function test_an_empty_or_unusable_label_falls_back_to_a_default_name(): void
    {
        $this->assertSame(__('Route') . '.gpx', $this->downloadName->filename(''));
        $this->assertSame(__('Route') . '.gpx', $this->downloadName->filename(' ... '));
        $this->assertSame('route.gpx', $this->downloadName->asciiFilename('🏃🏃'));
    }

    public function test_a_long_label_is_shortened(): void
    {
        $filename = $this->downloadName->filename(str_repeat('é', 300));

        $this->assertSame(104, mb_strlen($filename));
        $this->assertStringEndsWith('.gpx', $filename);
    }
}
