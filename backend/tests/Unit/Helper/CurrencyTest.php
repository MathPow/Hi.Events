<?php

namespace Tests\Unit\Helper;

use HiEvents\Helper\Currency;
use Tests\TestCase;

class CurrencyTest extends TestCase
{
    public function test_it_formats_amounts_the_quebec_way_in_french(): void
    {
        app()->setLocale('fr');

        $this->assertSame('1 234,50 $', $this->normalizeSpaces(Currency::format(1234.5, 'CAD')));
    }

    public function test_it_keeps_the_us_format_in_english(): void
    {
        app()->setLocale('en');

        $this->assertSame('CA$1,234.50', Currency::format(1234.5, 'CAD'));
    }

    public function test_an_explicit_locale_wins(): void
    {
        app()->setLocale('fr');

        $this->assertSame('$1,234.50', Currency::format(1234.5, 'USD', 'en_US'));
    }

    private function normalizeSpaces(string $text): string
    {
        return str_replace(["\u{00A0}", "\u{202F}"], ' ', $text);
    }
}
