<?php

namespace HiEvents\Services\Application\Handlers\EventChange;

use HiEvents\DomainObjects\Generated\EventChangeRefundDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrderDomainObjectAbstract;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Exceptions\InvalidRefundRequestTokenException;
use HiEvents\Exceptions\RefundRequestNotAllowedException;
use HiEvents\Mail\EventChange\ManualRefundRequiredMail;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestDTO;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestViewDTO;
use HiEvents\Services\Domain\EventChange\DTO\RefundRequestContextDTO;
use HiEvents\Services\Domain\EventChange\EventOrderRefundService;
use HiEvents\Services\Domain\EventChange\RefundRequestService;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\DatabaseManager;
use Throwable;

/**
 * A participant of a postponed event who can no longer come: their order is cancelled (tickets void,
 * spots freed) and refunded in full, all or nothing. Under the order's lock, a second click finds it
 * already cancelled and nothing is refunded twice.
 */
class SubmitRefundRequestHandler
{
    public function __construct(
        private readonly RefundRequestService                 $refundRequestService,
        private readonly EventOrderRefundService              $eventOrderRefundService,
        private readonly EventChangeRefundRepositoryInterface $eventChangeRefundRepository,
        private readonly RefundRequestViewFactory             $viewFactory,
        private readonly DatabaseManager                      $databaseManager,
        private readonly Mailer                               $mailer,
    )
    {
    }

    /**
     * @throws InvalidRefundRequestTokenException
     * @throws RefundRequestNotAllowedException
     * @throws Throwable
     */
    public function handle(RefundRequestDTO $dto): RefundRequestViewDTO
    {
        return $this->databaseManager->transaction(function () use ($dto) {
            $context = $this->refundRequestService->resolve($dto);
            $this->eventOrderRefundService->lockOrder($context->order->getId());

            $context = new RefundRequestContextDTO(
                event: $context->event,
                dateChange: $context->dateChange,
                order: $this->eventOrderRefundService->findOrder([
                    OrderDomainObjectAbstract::ID => $context->order->getId(),
                ]),
                refund: $context->refund,
            );

            $refusal = $this->refundRequestService->refusal($context);
            if ($refusal !== null) {
                throw new RefundRequestNotAllowedException($refusal);
            }

            $order = $context->order;
            $paidOnline = $this->eventOrderRefundService->isPaidOnline($order);

            $this->eventOrderRefundService->cancel($order, notifyBuyer: !$paidOnline);
            $outcome = $this->eventOrderRefundService->refund($order, notifyBuyer: true);

            $this->eventChangeRefundRepository->create([
                EventChangeRefundDomainObjectAbstract::EVENT_ID => $order->getEventId(),
                EventChangeRefundDomainObjectAbstract::ORDER_ID => $order->getId(),
                EventChangeRefundDomainObjectAbstract::EVENT_DATE_CHANGE_ID => $context->dateChange->getId(),
                EventChangeRefundDomainObjectAbstract::STATUS => $outcome->status->name,
                EventChangeRefundDomainObjectAbstract::AMOUNT => $outcome->amount,
                EventChangeRefundDomainObjectAbstract::CURRENCY => $order->getCurrency(),
            ]);

            if ($outcome->status === EventChangeRefundStatus::MANUAL_REFUND_REQUIRED) {
                $this->notifyOrganizer($context, $outcome->amount);
            }

            return $this->viewFactory->make($context, null, $outcome->status->name);
        });
    }

    private function notifyOrganizer(RefundRequestContextDTO $context, float $amount): void
    {
        $email = $context->event->getOrganizer()?->getEmail() ?: $context->event->getEventSettings()?->getSupportEmail();

        if (!$email) {
            return;
        }

        $this->mailer
            ->to($email)
            ->send(new ManualRefundRequiredMail(order: $context->order, event: $context->event, amount: $amount));
    }
}
