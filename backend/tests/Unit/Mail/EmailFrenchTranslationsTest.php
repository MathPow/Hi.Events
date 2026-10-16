<?php

namespace Tests\Unit\Mail;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class EmailFrenchTranslationsTest extends TestCase
{
    public function test_every_email_string_has_a_french_translation(): void
    {
        $translations = json_decode(File::get(lang_path('fr.json')), true);

        $missing = array_values(array_filter(
            $this->emailStrings(),
            static fn (string $key) => ($translations[$key] ?? '') === '',
        ));

        $this->assertSame([], $missing, 'Email strings without a French translation in lang/fr.json');
    }

    public function test_french_email_translations_keep_their_placeholders(): void
    {
        $translations = json_decode(File::get(lang_path('fr.json')), true);
        $broken = [];

        foreach ($this->emailStrings() as $key) {
            preg_match_all('/:([a-zA-Z_]+)/', $key, $placeholders);

            foreach ($placeholders[0] as $placeholder) {
                if (! str_contains($translations[$key] ?? '', $placeholder)) {
                    $broken[] = "$key ($placeholder)";
                }
            }
        }

        $this->assertSame([], $broken, 'French translations missing a placeholder from the source string');
    }

    /**
     * @return array<int, string>
     */
    private function emailStrings(): array
    {
        $files = collect([
            ...File::allFiles(resource_path('views/emails')),
            ...File::allFiles(resource_path('views/vendor/mail')),
            ...File::allFiles(app_path('Mail')),
        ])
            ->map(static fn ($file) => $file->getPathname())
            ->merge([
                resource_path('views/attendee-tickets.blade.php'),
                resource_path('views/invoice.blade.php'),
            ])
            ->filter(static fn (string $path) => str_ends_with($path, '.php'));

        $strings = [];

        foreach ($files as $path) {
            preg_match_all(
                '/(?:__|trans_choice|@lang)\(\s*([\'"])((?:\\\\.|(?!\1).)*)\1/s',
                File::get($path),
                $matches,
                PREG_SET_ORDER,
            );

            foreach ($matches as [, $quote, $string]) {
                $strings[] = $quote === "'"
                    ? str_replace("\\'", "'", $string)
                    : str_replace('\\"', '"', $string);
            }
        }

        return array_values(array_unique($strings));
    }
}
