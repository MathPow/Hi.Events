<?php

namespace HiEvents\Http\Actions\Organizers\PageImport;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO\ImportOrganizerPageDTO;
use HiEvents\Services\Application\Handlers\Organizer\PageImport\ImportOrganizerPageHandler;
use HiEvents\Services\Infrastructure\WebPage\UnsafeUrlException;
use HiEvents\Services\Infrastructure\WebPage\WebPageFetchException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Suggestions for « Ma page » from the organizer's website or Instagram; nothing is saved. */
class ImportOrganizerPageAction extends BaseAction
{
    public function __construct(
        private readonly ImportOrganizerPageHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request, int $organizerId): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $validated = $request->validate([
            'url' => ['required', 'string', 'max:2048'],
        ]);

        try {
            $suggestion = $this->handler->handle(new ImportOrganizerPageDTO(
                accountId: $this->getAuthenticatedAccountId(),
                userId: $this->getAuthenticatedUser()->getId(),
                url: $validated['url'],
            ));
        } catch (UnsafeUrlException|WebPageFetchException $exception) {
            throw ValidationException::withMessages(['url' => $exception->getMessage()]);
        }

        return $this->jsonResponse($suggestion->toArray());
    }
}
