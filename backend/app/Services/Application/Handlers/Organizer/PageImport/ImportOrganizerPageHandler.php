<?php

namespace HiEvents\Services\Application\Handlers\Organizer\PageImport;

use HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO\ImportOrganizerPageDTO;
use HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO\OrganizerPageSuggestionDTO;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use HiEvents\Services\Domain\Organizer\PageImport\AccentColorPicker;
use HiEvents\Services\Domain\Organizer\PageImport\ChosenImage;
use HiEvents\Services\Domain\Organizer\PageImport\HostingPlatforms;
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
 * « Remplir depuis votre site ou votre Instagram » de « Ma page » et de l'accueil
 * des nouveaux comptes : la page est lue, ses images choisies, sa couleur reprise
 * et ses textes reecrits par l'assistant. Sur une billetterie ou un reseau, seul
 * ce qui est a l'organisateur est garde. Rien n'est enregistre ici.
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
        private readonly HostingPlatforms      $platforms,
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
        $social = $this->reader->socialLink($url);
        $isInstagram = $social !== null && $social[0] === 'instagram';

        $page = $this->fetcher->fetch($url, self::MAX_PAGE_BYTES, truncate: true);
        // Instagram qui refuse de montrer le compte redirige vers sa connexion : son logo et son nom a lui.
        if ($isInstagram && preg_match('#^/(accounts/login|challenge)(/|$)#', (string)parse_url($page->url, PHP_URL_PATH))) {
            throw new WebPageFetchException(__('Instagram is not showing this account right now. Try again in a few minutes, or paste the address of your website.'));
        }
        if (!$page->isHtml()) {
            throw new WebPageFetchException(__('This address is not a web page.'));
        }
        $platform = $this->platforms->of($page->url);
        if ($platform !== null && $this->platforms->isHomePage($page->url)) {
            throw new WebPageFetchException(__('This is the home page of :platform. Paste the address of your own page or of one of your events.', ['platform' => $platform]));
        }
        $snapshot = $this->reader->read($page, $platform !== null
            ? fn(string $handle) => $this->platforms->isNamedAfter($platform, $handle)
            : null);

        // Sur Instagram, l'image de la page est la photo de profil : un logo, pas une couverture.
        // Sur une billetterie, les logos trouves sont ceux de la billetterie.
        $logo = match (true) {
            $isInstagram => $this->imageChooser->logo($snapshot->coverCandidates),
            $platform !== null => null,
            default => $this->imageChooser->logo($snapshot->logoCandidates),
        };
        $cover = $isInstagram ? null : $this->imageChooser->cover(array_values(array_filter(
            $snapshot->coverCandidates,
            fn(string $candidate) => $candidate !== $logo?->url
                && ($platform === null || !$this->platforms->isGenericImage($candidate)),
        )));

        $texts = $this->texts($snapshot, $dto, $platform);

        return new OrganizerPageSuggestionDTO(
            source_url: $page->url,
            source: $isInstagram ? 'instagram' : ($platform !== null ? 'platform' : 'website'),
            platform: $platform,
            name: $texts?->name ?? ($platform !== null ? $this->organizerOnPlatform($snapshot, $platform) : $this->fallbackName($snapshot)),
            description: $texts?->descriptionHtml ?? ($platform !== null ? null : $this->fallbackDescription($snapshot, $isInstagram)),
            accent: $platform !== null ? null : $this->accentPicker->pick($snapshot->themeColor, $logo?->bytes),
            logo: $this->dataUrl($logo, 1000),
            cover: $this->dataUrl($cover, 2400),
            social_links: $this->socialLinks($snapshot, $social),
            faqs: $texts?->faqs ?? [],
            written_by_assistant: $texts !== null,
            // Sans compte, Instagram ne montre que la photo et la bio.
            limited: $isInstagram || mb_strlen($snapshot->text) < self::LIMITED_TEXT,
        );
    }

    /** Par l'assistant quand il est la et qu'il reste des tours aujourd'hui ; sinon tel quel. */
    private function texts(WebsiteSnapshot $snapshot, ImportOrganizerPageDTO $dto, ?string $platform): ?PageTexts
    {
        // Rien a lire (Facebook sans compte) : pas de tour paye pour rien.
        if ($snapshot->text === '' && $snapshot->descriptions === []) {
            return null;
        }
        if (!$this->textWriter->isAvailable() || !$this->quotaService->consume($dto->accountId)) {
            return null;
        }

        return $this->textWriter->write($snapshot, $dto->accountId, $dto->userId, $platform);
    }

    /**
     * Le compte colle passe en premier.
     *
     * @param array{0: string, 1: string}|null $social
     * @return list<array{platform: string, handle: string}>
     */
    private function socialLinks(WebsiteSnapshot $snapshot, ?array $social): array
    {
        if ($social === null) {
            return $snapshot->socialLinks;
        }

        return [
            ['platform' => $social[0], 'handle' => $social[1]],
            ...array_values(array_filter($snapshot->socialLinks, fn($link) => $link['platform'] !== $social[0])),
        ];
    }

    /** Sans l'assistant : l'organisateur declare, « Club X presente … » dans le titre, ou le seul nom qui n'est pas celui de la plateforme. */
    private function organizerOnPlatform(WebsiteSnapshot $snapshot, string $platform): ?string
    {
        if ($snapshot->organizerName !== null) {
            return $snapshot->organizerName;
        }
        foreach ($snapshot->names as $name) {
            if (preg_match('/^(.{2,60}?)\s+(?:présente|presente|presents)\s/iu', $name, $match)) {
                return trim($match[1]);
            }
        }

        $others = array_values(array_filter($snapshot->names, fn(string $name) => !$this->platforms->isNamedAfter($platform, $name)));

        return count($others) === 1 ? $others[0] : null;
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
