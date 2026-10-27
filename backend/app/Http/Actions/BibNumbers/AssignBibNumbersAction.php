<?php

namespace HiEvents\Http\Actions\BibNumbers;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Domain\Attendee\BibNumberService;
use Illuminate\Http\JsonResponse;
use Throwable;

/**
 * Gives a bib to every active attendee who has none, for those who registered
 * before the first numbers were set.
 */
class AssignBibNumbersAction extends BaseAction
{
    public function __construct(
        private readonly BibNumberService $bibNumberService,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function __invoke(int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        return $this->jsonResponse(['assigned' => $this->bibNumberService->assignMissing($eventId)], wrapInData: true);
    }
}
