<?php

namespace HiEvents\Services\Domain\User;

use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Helper\Url;
use HiEvents\Mail\User\UserInvited;
use HiEvents\Services\Domain\Account\OrganizerEmailQuotaService;
use HiEvents\Services\Infrastructure\Encryption\EncryptedPayloadService;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Mail\Mailer;

class SendUserInvitationService
{
    private EncryptedPayloadService $encryptedPayloadService;

    private Mailer $mailer;

    private Repository $config;

    private OrganizerEmailQuotaService $emailQuotaService;

    public function __construct(
        EncryptedPayloadService    $encryptedPayloadService,
        Mailer                     $mailer,
        Repository                 $config,
        OrganizerEmailQuotaService $emailQuotaService,
    )
    {
        $this->encryptedPayloadService = $encryptedPayloadService;
        $this->mailer = $mailer;
        $this->config = $config;
        $this->emailQuotaService = $emailQuotaService;
    }

    public function sendInvitation(UserDomainObject $invitedUser, int $accountId): void
    {
        $this->emailQuotaService->consumeForAccount($accountId);

        $invitedPayload = $this->encryptedPayloadService->encryptPayload(
            payload: [
                'user_id' => $invitedUser->getId(),
                'account_id' => $accountId,
            ],
            expiry: now()->addWeek(),
        );

        $this->mailer
            ->to($invitedUser->getEmail())
            ->locale($invitedUser->getLocale())
            ->send(new UserInvited(
                invitedUser: $invitedUser,
                appName: $this->config->get('app.name'),
                inviteLink: sprintf(Url::getFrontEndUrlFromConfig(Url::ACCEPT_INVITATION), $invitedPayload),
            ));
    }
}
