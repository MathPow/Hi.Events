<?php

namespace HiEvents\Http\Actions\CheckInLists\Public;

use HiEvents\Exceptions\DoorSalesNotEnabledException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\DoorSale\DoorSaleProductResource;
use HiEvents\Services\Application\Handlers\CheckInList\Public\GetDoorSaleProductsPublicHandler;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class GetDoorSaleProductsPublicAction extends BaseAction
{
    public function __construct(
        private readonly GetDoorSaleProductsPublicHandler $getDoorSaleProductsPublicHandler,
    )
    {
    }

    public function __invoke(string $checkInListShortId): JsonResponse
    {
        try {
            $products = $this->getDoorSaleProductsPublicHandler->handle($checkInListShortId);
        } catch (DoorSalesNotEnabledException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: Response::HTTP_FORBIDDEN,
            );
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: Response::HTTP_NOT_FOUND,
            );
        }

        return $this->resourceResponse(
            resource: DoorSaleProductResource::class,
            data: $products,
        );
    }
}
