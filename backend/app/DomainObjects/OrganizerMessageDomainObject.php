<?php

namespace HiEvents\DomainObjects;

class OrganizerMessageDomainObject extends Generated\OrganizerMessageDomainObjectAbstract
{
    private ?EventDomainObject $event = null;

    public function getEvent(): ?EventDomainObject
    {
        return $this->event;
    }

    public function setEvent(?EventDomainObject $event): self
    {
        $this->event = $event;

        return $this;
    }
}
