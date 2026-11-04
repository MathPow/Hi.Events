<?php

namespace HiEvents\DomainObjects;

use HiEvents\DomainObjects\Enums\DocumentAudience;
use HiEvents\Services\Domain\Waiver\WaiverService;

class OrganizerDocumentDomainObject extends Generated\OrganizerDocumentDomainObjectAbstract
{
    /** @var int[] The events the document is linked to. */
    private array $eventIds = [];

    public function getEventIds(): array
    {
        return $this->eventIds;
    }

    public function setEventIds(array $eventIds): self
    {
        $this->eventIds = array_values(array_map('intval', $eventIds));

        return $this;
    }

    /**
     * For a document « selon l'âge »: it is for the participants under this age on the event's day.
     * Null when everyone fills it.
     */
    public function ageLimit(): ?int
    {
        if ($this->getAudience() !== DocumentAudience::MINORS->value) {
            return null;
        }

        return $this->getAudienceAge() ?? WaiverService::ADULT_AGE;
    }
}
