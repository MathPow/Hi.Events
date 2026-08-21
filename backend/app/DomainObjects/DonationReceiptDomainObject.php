<?php

namespace HiEvents\DomainObjects;

class DonationReceiptDomainObject extends Generated\DonationReceiptDomainObjectAbstract
{
    public ?OrderDomainObject $order = null;

    public ?OrganizerDomainObject $organizer = null;

    public function getOrder(): ?OrderDomainObject
    {
        return $this->order;
    }

    public function setOrder(?OrderDomainObject $order): self
    {
        $this->order = $order;

        return $this;
    }

    public function getOrganizer(): ?OrganizerDomainObject
    {
        return $this->organizer;
    }

    public function setOrganizer(?OrganizerDomainObject $organizer): self
    {
        $this->organizer = $organizer;

        return $this;
    }
}
