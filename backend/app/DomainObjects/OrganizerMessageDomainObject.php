<?php

namespace HiEvents\DomainObjects;

use Illuminate\Support\Collection;

class OrganizerMessageDomainObject extends Generated\OrganizerMessageDomainObjectAbstract
{
    private ?EventDomainObject $event = null;

    private ?Collection $replies = null;

    public function getEvent(): ?EventDomainObject
    {
        return $this->event;
    }

    public function setEvent(?EventDomainObject $event): self
    {
        $this->event = $event;

        return $this;
    }

    public function getReplies(): ?Collection
    {
        return $this->replies;
    }

    public function setReplies(?Collection $replies): self
    {
        $this->replies = $replies;

        return $this;
    }
}
