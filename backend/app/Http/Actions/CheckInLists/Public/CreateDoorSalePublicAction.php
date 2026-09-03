<?php

namespace HiEvents\Http\Actions\CheckInLists\Public;

use HiEvents\Exceptions\CannotCheckInException;
use HiEvents\Exceptions\DoorSalesNotEnabledException;
use HiEvents\Exceptions\InvalidProductPriceId;
use HiEvents\Exceptions\NoTicketsAvailableException;
use HiEvents\Exceptions\ProductNotOnCheckInListException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\CheckInList\CreateDoorSaleRequest;
use HiEvents\Resources\Attendee\AttendeeResourcePublic;
use HiEvents\Services\Application\Handlers\CheckInList\Public\CreateDoorSaleHandler;
use HiEvents\Services\Application\Handlers\CheckInList\Public\DTO\CreateDoorSaleDTO;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class CreateDoorSalePublicAction extends BaseAction
{
    public function __construct(
        private readonly CreateDoorSaleHandler $createDoorSaleHandler,
    )
    {
    }

    public function __invoke(string $checkInListShortId, CreateDoorSaleRequest $request): JsonResponse
    {
        try {
            $attendees = $this->createDoorSaleHandler->handle(new CreateDoorSaleDTO(
                checkInListShortId: $checkInListShortId,
                productId: $request->validated('product_id'),
                quantity: $request->validated('quantity'),
                firstName: $request->validated('first_name'),
                lastName: $request->validated('last_name') ?? '',
                locale: $request->validated('locale') ?? config('app.locale'),
                checkInUserIpAddress: $request->ip(),
                productPriceId: $request->validated('product_price_id'),
                email: $request->validated('email'),
                checkInImmediately: $request->boolean('check_in_immediately', true),
            ));
        } catch (DoorSalesNotEnabledException|ProductNotOnCheckInListException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: Response::HTTP_FORBIDDEN,
            );
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: Response::HTTP_NOT_FOUND,
            );
        } catch (NoTicketsAvailableException|InvalidProductPriceId|CannotCheckInException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: Response::HTTP_CONFLICT,
            );
        }

        return $this->resourceResponse(
            resource: AttendeeResourcePublic::class,
            data: $attendees,
            statusCode: Response::HTTP_CREATED,
        );
    }
}
