<?php

namespace HiEvents\Services\Domain\EventChange;

use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use Illuminate\Config\Repository;

/**
 * The link of « Je ne peux plus venir : me faire rembourser »: signed with the app key for one order
 * and one change of date, so nobody can ask for someone else's refund.
 */
class RefundRequestTokenService
{
    public function __construct(private readonly Repository $config)
    {
    }

    public function token(int $orderId, int $dateChangeId): string
    {
        return hash_hmac('sha256', "refund-request|$orderId|$dateChangeId", (string)$this->config->get('app.key'));
    }

    public function isValid(int $orderId, int $dateChangeId, ?string $token): bool
    {
        return $token !== null && $token !== '' && hash_equals($this->token($orderId, $dateChangeId), $token);
    }

    public function url(OrderDomainObject $order, EventDateChangeDomainObject $dateChange): string
    {
        return sprintf(
            '%s/order/%d/%s/refund-request?%s',
            rtrim((string)$this->config->get('app.frontend_url'), '/'),
            $order->getEventId(),
            $order->getShortId(),
            http_build_query([
                'change' => $dateChange->getId(),
                'token' => $this->token($order->getId(), $dateChange->getId()),
            ]),
        );
    }
}
