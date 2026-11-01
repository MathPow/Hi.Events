<?php

namespace HiEvents\Services\Application\Handlers\Organizer\PageImport;

use HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO\ImportOrganizerPageDTO;
use HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO\OrganizerPageSuggestionDTO;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use HiEvents\Services\Domain\Organizer\PageImport\AccentColorPicker;
use HiEvents\Services\Domain\Organizer\PageImport\ChosenImage;
use HiEvents\Services\Domain\Organizer\PageImport\PageImageChooser;
use HiEvents\Services\Domain\Organizer\PageImport\PageTexts;
use HiEvents\Services\Domain\Organizer\PageImport\PageTextWriter;
use HiEvents\Services\Domain\Organizer\PageImport\WebsiteReader;
use HiEvents\Services\Domain\Organizer\PageImport\WebsiteSnapshot;
use HiEvents\Services\Infrastructure\WebPage\SafeWebFetcher;
use HiEvents\Services\Infrastructure\WebPage\UnsafeUrlException;
use HiEvents\Services\Infrastructure\WebPage\WebPageFetchException;
use Imagick;
use Throwable;

/**
 * « Remplir depuis votre site ou votre Instagram » de « Ma page » : la page est
 * lue, ses images choisies, sa couleur reprise et ses textes reecrits par
 * l'assistant. Rien n'est enregistre ici : tout part dans le brouillon.
 */
class ImportOrganizerPageHandler
{
    private const MAX_PAGE_BYTES = 2 * 1024 * 1024;

    /** En dessous, la page n'a presque rien montre (Instagram sans compte, page vide). */
    private const LIMITED_TEXT = 200;

    public function __construct(
        private readonly SafeWebFetcher        $fetcher,
        private readonly WebsiteReader         $reader,
        private readonly PageImageChooser      $imageChooser,
        private readonly AccentColorPicker     $accentPicker,
        private readonly PageTextWriter        $textWriter,
        private readonly AssistantQuotaService $quotaService,
    )
    {
    }

    /**
     * @throws UnsafeUrlException
     * @throws WebPageFetchException
     */
    public function handle(ImportOrganizerPageDTO $dto): OrganizerPageSuggestionDTO
    {
        $url = $this->fetcher->normalize($dto->url);
        $instagram = $this->reader->socialLink($url);
        $isInstagram = $instagram !== null && $instagram[0] === 'instagram';

        $page = $this->fetcher->fetch($url, self::MAX_PAGE_BYTES, truncate: true);
        if (!$page->isHtml()) {
            throw new WebPageFetchException(__('This address is not a web page.'));
        }
        $snapshot = $this->reader->read($page);

        // Sur Instagram, l'image de la page est la photo de profil : un logo, pas une couverture.
        $logo = $this->imageChooser->logo($isInstagram ? $snapshot->coverCandidates : $snapshot->logoCandidates);
        $cover = $isInstagram ? null : $this->imageChooser->cover(array_values(array_filter(
            $snapshot->coverCandidates,
            fn(string $candidate) => $candidate !== $logo?->url,
        )));

        $texts = $this->texts($snapshot, $dto);
        $socialLinks = $snapshot->socialLinks;
        if ($isInstagram) {
            $socialLinks = [
                ['platform' => 'instagram', 'handle' => $instagram[1]],
                ...array_filter($socialLinks, fn($link) => $link['platform'] !== 'instagram'),
            ];
        }

        return new OrganizerPageSuggestionDTO(
            source_url: $page->url,
            source: $isInstagram ? 'instagram' : 'website',
            name: $texts?->name ?? $this->fallbackName($snapshot),
            description: $texts?->descriptionHtml ?? $this->fallbackDescription($snapshot, $isInstagram),
            accent: $this->accentPicker->pick($snapshot->themeColor, $logo?->bytes),
            logo: $this->dataUrl($logo, 1000),
            cover: $this->dataUrl($cover, 2400),
            social_links: array_values($socialLinks),
            faqs: $texts?->faqs ?? [],
            written_by_assistant: $texts !== null,
            // Sans compte, Instagram ne montre que la photo et la bio.
            limited: $isInstagram || mb_strlen($snapshot->text) < self::LIMITED_TEXT,
        );
    }

    /** Par l'assistant quand il est la et qu'il reste des tours aujourd'hui ; sinon tel quel. */
    private function texts(WebsiteSnapshot $snapshot, ImportOrganizerPageDTO $dto): ?PageTexts
    {
        if (!$this->textWriter->isAvailable() || !$this->quotaService->consume($dto->accountId)) {
            return null;
        }

        return $this->textWriter->write($snapshot, $dto->accountId, $dto->userId);
    }

    /** « Club X (@clubx) • Instagram photos and videos », « Accueil | Club X » => le nom seul. */
    private function fallbackName(WebsiteSnapshot $snapshot): ?string
    {
        $name = $snapshot->names[0] ?? null;
        if ($name === null) {
            return null;
        }
        $name = preg_replace('/\s*\(@[^)]*\).*$/u', '', $name);
        $parts = preg_split('/\s+[|•–—-]\s+/u', $name);

        return trim(count($parts) > 1 && preg_match('/^(accueil|home|bienvenue|welcome)$/iu', trim($parts[0])) ? $parts[1] : $parts[0]) ?: null;
    }

    private function fallbackDescription(WebsiteSnapshot $snapshot, bool $isInstagram): ?string
    {
        $description = $snapshot->descriptions[0] ?? null;

        // « 90 abonnés, 67 abonnements… – Club (@club) sur Instagram : « la bio » » : la bio seule, s'il y en a une.
        if ($isInstagram && $description !== null) {
            $description = preg_match('/(?:on|sur) Instagram\s*:\s*[«"“]\s*(.+?)\s*[»"”]\s*$/su', $description, $match) ? $match[1] : null;
        }

        return $description !== null ? '<p>' . htmlspecialchars($description, ENT_NOQUOTES, 'UTF-8') . '</p>' : null;
    }

    /** L'image prete pour le brouillon, reduite si elle est plus large que $maxWidth. */
    private function dataUrl(?ChosenImage $image, int $maxWidth): ?string
    {
        if ($image === null) {
            return null;
        }

        $bytes = $image->bytes;
        $mime = $image->mimeType;

        if ($image->width > $maxWidth || strlen($bytes) > 2 * 1024 * 1024) {
            try {
                $resized = new Imagick();
                $resized->readImageBlob($bytes);
                $resized->setIteratorIndex(0);
                $resized->thumbnailImage(min($maxWidth, $image->width), 0);
                if ($mime !== 'image/png') {
                    $resized->setImageFormat('jpeg');
                    $resized->setImageCompressionQuality(85);
                    $mime = 'image/jpeg';
                }
                $bytes = $resized->getImageBlob();
                $resized->clear();
            } catch (Throwable) {
                // Telle quelle : le serveur la reduira a l'envoi.
            }
        }

        return sprintf('data:%s;base64,%s', $mime, base64_encode($bytes));
    }
}
