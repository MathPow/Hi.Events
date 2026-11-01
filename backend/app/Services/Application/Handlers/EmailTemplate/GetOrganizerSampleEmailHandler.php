<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\EmailTemplate;

use HiEvents\DomainObjects\Generated\OrganizerDomainObjectAbstract;
use HiEvents\DomainObjects\ImageDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\OrganizerSampleEmailDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\RenderedSampleEmailDTO;
use HiEvents\Services\Domain\Email\SampleEmailService;
use HiEvents\Exceptions\ResourceNotFoundException;

class GetOrganizerSampleEmailHandler
{
    public function __construct(
        private readonly OrganizerRepositoryInterface $organizerRepository,
        private readonly SampleEmailService           $sampleEmailService,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function handle(OrganizerSampleEmailDTO $dto): RenderedSampleEmailDTO
    {
        /** @var OrganizerDomainObject|null $organizer */
        $organizer = $this->organizerRepository
            ->loadRelation(ImageDomainObject::class)
            ->loadRelation(OrganizerSettingDomainObject::class)
            ->findFirstWhere([
                OrganizerDomainObjectAbstract::ID => $dto->organizerId,
                OrganizerDomainObjectAbstract::ACCOUNT_ID => $dto->accountId,
            ]);

        if ($organizer === null) {
            throw new ResourceNotFoundException(__('Organizer not found'));
        }

        $mail = $this->sampleEmailService
            ->buildMail($dto->type, $organizer)
            ->locale(app()->getLocale());

        return new RenderedSampleEmailDTO(
            subject: (string)$mail->envelope()->subject,
            html: (string)$mail->render(),
        );
    }
}
