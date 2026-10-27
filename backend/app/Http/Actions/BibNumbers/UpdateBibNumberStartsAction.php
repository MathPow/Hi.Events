<?php

namespace HiEvents\Http\Actions\BibNumbers;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\InvalidProductPriceId;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\BibNumbers\UpdateBibNumberStartsRequest;
use HiEvents\Services\Application\Handlers\BibNumbers\UpdateBibNumberStartsHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class UpdateBibNumberStartsAction extends BaseAction
{
    public function __construct(
        private readonly UpdateBibNumberStartsHandler $updateBibNumberStartsHandler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(UpdateBibNumberStartsRequest $request, int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        $starts = collect($request->validated('starts'))
            ->mapWithKeys(fn(array $start) => [(int)$start['product_price_id'] => $start['bib_number_start'] ?? null])
            ->all();

        try {
            $this->updateBibNumberStartsHandler->handle($eventId, $starts);
        } catch (InvalidProductPriceId $exception) {
            throw ValidationException::withMessages(['starts' => $exception->getMessage()]);
        }

        return $this->jsonResponse(['starts' => $request->validated('starts')], wrapInData: true);
    }
}
