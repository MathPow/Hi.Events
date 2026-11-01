<?php

namespace HiEvents\DomainObjects;

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
}
