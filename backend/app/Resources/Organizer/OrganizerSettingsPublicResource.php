<?php

namespace HiEvents\Resources\Organizer;

use HiEvents\DomainObjects\Enums\TrackingPixelProvider;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;

/**
 * @mixin OrganizerSettingDomainObject
 */
class OrganizerSettingsPublicResource extends OrganizerSettingsResource
{
    public function toArray($request): array
    {
        $data = parent::toArray($request);

        unset(
            $data['tracking_consent_acknowledged'],
            $data['homepage_password'],
        );

        // Reglages internes de l'organisme emetteur: ils n'ont aucun usage sur la
        // page publique, et le nom du signataire est une donnee personnelle.
        // Cette resource etend la privee, donc sans ce unset ils fuiteraient.
        unset(
            $data['charity_registration_number'],
            $data['charity_legal_name'],
            $data['charity_address'],
            $data['charity_signatory_name'],
            $data['charity_receipt_prefix'],
        );

        if (config('app.saas_mode_enabled') && !empty($data['tracking_pixels'])) {
            $data['tracking_pixels'] = array_values(array_filter(
                $data['tracking_pixels'],
                fn($pixel) => ($pixel['provider'] ?? null) !== TrackingPixelProvider::GOOGLE_TAG_MANAGER->value,
            ));
        }

        return $data;
    }
}
