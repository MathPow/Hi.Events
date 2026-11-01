<?php

namespace HiEvents\Resources\Organizer;

use HiEvents\DomainObjects\OrganizerSettingDomainObject;

/**
 * @mixin OrganizerSettingDomainObject
 */
class OrganizerSettingsPublicResource extends OrganizerSettingsResource
{
    public function toArray($request): array
    {
        $data = parent::toArray($request);

        $data['social_media_handles'] = $this->getVisibleSocialMediaHandles();

        unset(
            $data['tracking_consent_acknowledged'],
            $data['homepage_password'],
            $data['tracking_pixels'],
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

        return $data;
    }
}
