<?php

namespace HiEvents\Http\Actions\Organizers\Messages;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\AccountNotVerifiedException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Organizer\OrganizerMessageResource;
use HiEvents\Services\Application\Handlers\Organizer\Messages\DTO\ReplyToOrganizerMessageDTO;
use HiEvents\Services\Application\Handlers\Organizer\Messages\ReplyToOrganizerMessageHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

/**
 * Repond a un message de la boite de reception, par courriel a la personne qui l'a ecrit.
 */
class ReplyToOrganizerMessageAction extends BaseAction
{
    public function __construct(
        private readonly ReplyToOrganizerMessageHandler $handler,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId, int $messageId): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $data = $this->validate($request, ['reply' => 'required|string|max:5000']);

        try {
            $message = $this->handler->handle(new ReplyToOrganizerMessageDTO(
                organizer_id: $organizerId,
                message_id: $messageId,
                reply: $data['reply'],
                // The language the organizer is using (SetUserLocaleMiddleware: their cookie, then their account).
                locale: app()->getLocale(),
                user_id: $this->getAuthenticatedUser()->getId(),
            ));
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse($exception->getMessage(), Response::HTTP_NOT_FOUND);
        } catch (AccountNotVerifiedException $exception) {
            // Not 401: the app would take it for an expired session and send to the login page.
            return $this->errorResponse($exception->getMessage(), Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return $this->resourceResponse(OrganizerMessageResource::class, $message);
    }
}
