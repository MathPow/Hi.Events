<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Affiliates;

use HiEvents\Exceptions\AffiliateNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Resources\Affiliate\AffiliatePartnerPageResourcePublic;
use HiEvents\Services\Application\Handlers\Affiliate\GetAffiliatePartnerPageHandler;
use Illuminate\Http\JsonResponse;

class GetAffiliatePartnerPagePublicAction extends BaseAction
{
    public function __construct(
        private readonly GetAffiliatePartnerPageHandler $handler,
    )
    {
    }

    public function __invoke(string $token): JsonResponse
    {
        try {
            $partnerPage = $this->handler->handle($token);
        } catch (AffiliateNotFoundException $e) {
            return $this->errorResponse(
                message: $e->getMessage(),
                statusCode: ResponseCodes::HTTP_NOT_FOUND,
            );
        }

        return $this->resourceResponse(
            resource: AffiliatePartnerPageResourcePublic::class,
            data: $partnerPage,
        );
    }
}
