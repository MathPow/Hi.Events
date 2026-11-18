<?php

namespace HiEvents\Services\Application\Handlers\EventChange;

use HiEvents\Exceptions\InvalidRefundRequestTokenException;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestDTO;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestViewDTO;
use HiEvents\Services\Domain\EventChange\RefundRequestService;

class GetRefundRequestHandler
{
    public function __construct(
        private readonly RefundRequestService     $refundRequestService,
        private readonly RefundRequestViewFactory $viewFactory,
    )
    {
    }

    /**
     * @throws InvalidRefundRequestTokenException
     */
    public function handle(RefundRequestDTO $dto): RefundRequestViewDTO
    {
        $context = $this->refundRequestService->resolve($dto);

        return $this->viewFactory->make($context, $this->refundRequestService->refusal($context));
    }
}
