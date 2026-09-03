<?php

namespace HiEvents\Exceptions\Square;

use HiEvents\Exceptions\BaseException;

class SquareApiException extends BaseException
{
    /**
     * Erreurs brutes renvoyees par Square, conservees pour le journal et pour
     * distinguer un refus de carte (recuperable par l'acheteur) d'une erreur
     * de configuration du marchand.
     */
    public array $squareErrors = [];

    public function getFirstErrorCode(): ?string
    {
        return $this->squareErrors[0]['code'] ?? null;
    }

    /**
     * Square classe les refus de carte dans CARD_DECLINED / CVV_FAILURE etc.
     * Ces cas doivent etre reaffiches a l'acheteur, pas traites comme une panne.
     */
    public function isBuyerFacing(): bool
    {
        $category = $this->squareErrors[0]['category'] ?? null;

        return in_array($category, ['PAYMENT_METHOD_ERROR', 'INVALID_REQUEST_ERROR'], true);
    }
}
