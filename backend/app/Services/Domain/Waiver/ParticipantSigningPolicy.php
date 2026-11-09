<?php

namespace HiEvents\Services\Domain\Waiver;

use HiEvents\DomainObjects\Enums\AttendeeDetailsCollectionMethod;
use HiEvents\DomainObjects\EventSettingDomainObject;

/**
 * Who signs the waiver and the online documents at checkout. By default the
 * buyer signs for every ticket; when the event asks each participant to sign
 * for themselves, the buyer signs only the tickets sent to their own email,
 * and the others sign later from their ticket's link (or at the door).
 */
class ParticipantSigningPolicy
{
    public function participantsSignThemselves(?EventSettingDomainObject $settings): bool
    {
        return $settings !== null
            && $settings->getParticipantsSignThemselves()
            && $settings->getAttendeeDetailsCollectionMethod() !== AttendeeDetailsCollectionMethod::PER_ORDER->name;
    }

    public function signsAtCheckout(?EventSettingDomainObject $settings, ?string $buyerEmail, ?string $attendeeEmail): bool
    {
        if (!$this->participantsSignThemselves($settings)) {
            return true;
        }

        $buyer = $this->normalize($buyerEmail);

        return $buyer !== '' && $buyer === $this->normalize($attendeeEmail);
    }

    private function normalize(?string $email): string
    {
        return mb_strtolower(trim((string)$email));
    }
}
