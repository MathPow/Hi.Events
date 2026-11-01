<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\EmailTemplate;

use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Mail\EmailTemplate\TestEmailMail;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\OrganizerSampleEmailDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\SendOrganizerTestEmailDTO;
use Illuminate\Mail\Mailer;

/**
 * Sends the email shown in the preview, as rendered, to the person asking for it (only to them).
 */
class SendOrganizerTestEmailHandler
{
    public function __construct(
        private readonly GetOrganizerSampleEmailHandler $sampleEmailHandler,
        private readonly UserRepositoryInterface        $userRepository,
        private readonly Mailer                         $mailer,
    )
    {
    }

    public function handle(SendOrganizerTestEmailDTO $dto): string
    {
        $sample = $this->sampleEmailHandler->handle(new OrganizerSampleEmailDTO(
            organizerId: $dto->organizerId,
            accountId: $dto->accountId,
            type: $dto->type,
        ));

        /** @var UserDomainObject $user */
        $user = $this->userRepository->findById($dto->userId);

        $this->mailer
            ->to($user->getEmail())
            ->send(new TestEmailMail(
                emailSubject: __('[Test] :subject', ['subject' => $sample->subject]),
                renderedHtml: $sample->html,
            ));

        return $user->getEmail();
    }
}
