<?php

namespace HiEvents\DomainObjects;

class SquarePaymentDomainObject extends Generated\SquarePaymentDomainObjectAbstract
{
    private ?OrderDomainObject $order = null;

    public function getOrder(): ?OrderDomainObject
    {
        return $this->order;
    }

    public function setOrder(?OrderDomainObject $order): self
    {
        $this->order = $order;
        return $this;
    }

    /**
     * Square considere un paiement acquis des qu'il est COMPLETED. APPROVED
     * signifie que les fonds sont seulement bloques (capture differee), ce qui
     * ne doit pas declencher l'emission des billets.
     */
    public function isCompleted(): bool
    {
        return $this->getStatus() === 'COMPLETED';
    }

    public function isFailed(): bool
    {
        return in_array($this->getStatus(), ['FAILED', 'CANCELED'], true);
    }

    public function getRefundableAmount(): int
    {
        return max(0, ($this->getAmountReceived() ?? 0) - $this->getRefundedAmount());
    }
}
