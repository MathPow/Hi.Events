<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Settings;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerSettingsRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\DTO\PartialUpdateOrganizerSettingsDTO;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;
use Spatie\LaravelData\Data;

class PartialUpdateOrganizerSettingsHandler
{
    public function __construct(
        private readonly OrganizerSettingsRepositoryInterface $organizerSettingsRepository,
        private readonly OrganizerRepositoryInterface         $organizerRepository,
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly EventSettingsRepositoryInterface     $eventSettingsRepository,
        private readonly HtmlPurifierService                  $purifier,
    )
    {
    }

    public function handle(PartialUpdateOrganizerSettingsDTO $dto): OrganizerSettingDomainObject
    {
        /** @var OrganizerDomainObject $organizer */
        $organizer = $this->organizerRepository->findFirstWhere([
            'id' => $dto->organizerId,
            'account_id' => $dto->accountId,
        ]);

        /** @var OrganizerSettingDomainObject $organizerSettings */
        $organizerSettings = $this->organizerSettingsRepository->findFirstWhere([
            'organizer_id' => $organizer->getId(),
        ]);

        $locationDetails = $dto->getProvided('locationDetails', $organizerSettings->getLocationDetails());

        if ($locationDetails instanceof Data) {
            $locationDetails = $locationDetails->toArray();
        } elseif (is_array($locationDetails)) {
            $locationDetails = array_filter($locationDetails);
        } else {
            $locationDetails = [];
        }

        $emailFooterMessage = $dto->wasProvided('emailFooterMessage')
            ? $this->cleanFooter($dto->emailFooterMessage)
            : $organizerSettings->getEmailFooterMessage();

        $this->organizerSettingsRepository->updateWhere([
            'default_attendee_details_collection_method' => $dto->getProvided(
                'defaultAttendeeDetailsCollectionMethod',
                $organizerSettings->getDefaultAttendeeDetailsCollectionMethod()
            )?->name ?? $organizerSettings->getDefaultAttendeeDetailsCollectionMethod(),

            'default_show_marketing_opt_in' => $dto->getProvided(
                'defaultShowMarketingOptIn',
                $organizerSettings->getDefaultShowMarketingOptIn()
            ),

            'default_pass_platform_fee_to_buyer' => $dto->getProvided(
                'defaultPassPlatformFeeToBuyer',
                $organizerSettings->getDefaultPassPlatformFeeToBuyer()
            ),

            'default_pass_processing_fee_to_buyer' => $dto->getProvided(
                'defaultPassProcessingFeeToBuyer',
                $organizerSettings->getDefaultPassProcessingFeeToBuyer()
            ),

            'platform_support_enabled' => $dto->getProvided(
                'platformSupportEnabled',
                $organizerSettings->getPlatformSupportEnabled()
            ) ?? true,

            'social_media_handles' => array_filter([
                'facebook' => $dto->getProvided('facebookHandle', $organizerSettings->getSocialMediaHandle('facebook')),
                'instagram' => $dto->getProvided('instagramHandle', $organizerSettings->getSocialMediaHandle('instagram')),
                'twitter' => $dto->getProvided('twitterHandle', $organizerSettings->getSocialMediaHandle('twitter')),
                'linkedin' => $dto->getProvided('linkedinHandle', $organizerSettings->getSocialMediaHandle('linkedin')),
                'discord' => $dto->getProvided('discordHandle', $organizerSettings->getSocialMediaHandle('discord')),
                'tiktok' => $dto->getProvided('tiktokHandle', $organizerSettings->getSocialMediaHandle('tiktok')),
                'youtube' => $dto->getProvided('youtubeHandle', $organizerSettings->getSocialMediaHandle('youtube')),
                'snapchat' => $dto->getProvided('snapchatHandle', $organizerSettings->getSocialMediaHandle('snapchat')),
                'twitch' => $dto->getProvided('twitchHandle', $organizerSettings->getSocialMediaHandle('twitch')),
                'reddit' => $dto->getProvided('redditHandle', $organizerSettings->getSocialMediaHandle('reddit')),
                'pinterest' => $dto->getProvided('pinterestHandle', $organizerSettings->getSocialMediaHandle('pinterest')),
                'whatsapp' => $dto->getProvided('whatsappHandle', $organizerSettings->getSocialMediaHandle('whatsapp')),
                'telegram' => $dto->getProvided('telegramHandle', $organizerSettings->getSocialMediaHandle('telegram')),
                'vk' => $dto->getProvided('vkHandle', $organizerSettings->getSocialMediaHandle('vk')),
                'weibo' => $dto->getProvided('weiboHandle', $organizerSettings->getSocialMediaHandle('weibo')),
                'wechat' => $dto->getProvided('wechatHandle', $organizerSettings->getSocialMediaHandle('wechat')),
                'flickr' => $dto->getProvided('flickrHandle', $organizerSettings->getSocialMediaHandle('flickr')),
                'tumblr' => $dto->getProvided('tumblrHandle', $organizerSettings->getSocialMediaHandle('tumblr')),
                'quora' => $dto->getProvided('quoraHandle', $organizerSettings->getSocialMediaHandle('quora')),
                'vimeo' => $dto->getProvided('vimeoHandle', $organizerSettings->getSocialMediaHandle('vimeo')),
                'github' => $dto->getProvided('githubHandle', $organizerSettings->getSocialMediaHandle('github')),
                'strava' => $dto->getProvided('stravaHandle', $organizerSettings->getSocialMediaHandle('strava')),
            ]),

            'social_media_layout' => $this->sanitizeSocialMediaLayout(
                $dto->getProvided('socialMediaLayout', $organizerSettings->getSocialMediaLayout())
            ),

            'website_url' => $dto->getProvided('websiteUrl', $organizerSettings->getWebsiteUrl()),

            'location_details' => $locationDetails,

            'homepage_visibility' => $dto->getProvided('homepageVisibility', $organizerSettings->getHomepageVisibility()),

            'homepage_theme_settings' => $dto->getProvided('homepageThemeSettings', $organizerSettings->getHomepageThemeSettings()),

            'seo_keywords' => $dto->getProvided('seoKeywords', $organizerSettings->getSeoKeywords()),
            'seo_title' => $dto->getProvided('seoTitle', $organizerSettings->getSeoTitle()),
            'seo_description' => $dto->getProvided('seoDescription', $organizerSettings->getSeoDescription()),
            'allow_search_engine_indexing' => $dto->getProvided('allowSearchEngineIndexing', $organizerSettings->getAllowSearchEngineIndexing()),

            'homepage_password' => $dto->getProvided('homepagePassword', $organizerSettings->getHomepagePassword()),

            'tracking_pixels' => $dto->getProvided('trackingPixels', $organizerSettings->getTrackingPixels()),
            'tracking_consent_acknowledged' => $dto->getProvided('trackingConsentAcknowledged', $organizerSettings->getTrackingConsentAcknowledged()),
            'faqs' => $this->sanitizeFaqs($dto->getProvided('faqs', $organizerSettings->getFaqs())),
            'charity_registration_number' => $dto->getProvided('charityRegistrationNumber', $organizerSettings->getCharityRegistrationNumber()),
            'charity_legal_name' => $dto->getProvided('charityLegalName', $organizerSettings->getCharityLegalName()),
            'charity_address' => $dto->getProvided('charityAddress', $organizerSettings->getCharityAddress()),
            'charity_signatory_name' => $dto->getProvided('charitySignatoryName', $organizerSettings->getCharitySignatoryName()),
            'charity_receipt_prefix' => $dto->getProvided('charityReceiptPrefix', $organizerSettings->getCharityReceiptPrefix()),
            'email_footer_message' => $emailFooterMessage,
        ], [
            'organizer_id' => $dto->organizerId,
            'id' => $organizerSettings->getId(),
        ]);

        if ($dto->wasProvided('emailFooterMessage')) {
            $this->applyEmailFooterToEvents($organizer->getId(), $emailFooterMessage);
        }

        return $this->organizerSettingsRepository->findFirst($organizerSettings->getId());
    }

    private function sanitizeSocialMediaLayout(array|string|null $layout): array
    {
        return collect(is_array($layout) ? $layout : [])
            ->filter(fn($entry) => is_array($entry)
                && in_array($entry['platform'] ?? null, OrganizerSettingDomainObject::SOCIAL_MEDIA_PLATFORMS, true))
            ->unique(fn(array $entry) => $entry['platform'])
            ->map(fn(array $entry) => [
                'platform' => $entry['platform'],
                'visible' => (bool) ($entry['visible'] ?? true),
            ])
            ->values()
            ->all();
    }

    /** An empty editor (« <p></p> ») is no footer. */
    private function cleanFooter(?string $html): ?string
    {
        $html = $this->purifier->purify($html);

        return trim(strip_tags((string)$html)) === '' ? null : $html;
    }

    /**
     * The emails read the footer from each event's settings: the organizer's footer replaces those of
     * all its events (the event no longer has its own, see « Courriels » of the organizer).
     */
    private function applyEmailFooterToEvents(int $organizerId, ?string $emailFooterMessage): void
    {
        $eventIds = $this->eventRepository
            ->findWhere(['organizer_id' => $organizerId])
            ->map(static fn($event) => $event->getId())
            ->all();

        if ($eventIds === []) {
            return;
        }

        $this->eventSettingsRepository->updateWhere(
            ['email_footer_message' => $emailFooterMessage],
            [['event_id', 'in', $eventIds]],
        );
    }

    private function sanitizeFaqs(?array $faqs): array
    {
        return collect($faqs ?? [])
            ->map(fn(array $faq) => [
                'question' => trim(strip_tags($faq['question'] ?? '')),
                'answer' => trim(strip_tags($faq['answer'] ?? '')),
            ])
            ->filter(fn(array $faq) => $faq['question'] !== '' && $faq['answer'] !== '')
            ->values()
            ->all();
    }
}
