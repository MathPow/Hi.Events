<?php

namespace HiEvents\Services\Domain\Notification;

use Carbon\Carbon;
use HiEvents\DomainObjects\PushSubscriptionDomainObject;
use HiEvents\Repository\Interfaces\PushSubscriptionRepositoryInterface;
use Illuminate\Config\Repository;
use Illuminate\Database\DatabaseManager;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\VAPID;
use Minishlink\WebPush\WebPush;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Les notifications Web Push (Chrome, Firefox, Safari et l'app installee sur iPhone).
 *
 * La paire de cles VAPID du serveur est creee au premier besoin et gardee en base: rien a
 * regler dans l'environnement. La changer desabonnerait tous les appareils.
 */
class WebPushService
{
    public function __construct(
        private readonly PushSubscriptionRepositoryInterface $subscriptionRepository,
        private readonly DatabaseManager                     $db,
        private readonly Repository                          $config,
        private readonly LoggerInterface                     $logger,
    )
    {
    }

    public function publicKey(): string
    {
        return $this->vapidKeys()['publicKey'];
    }

    /**
     * Enregistre (ou rafraichit) l'appareil d'un utilisateur. Un meme appareil passe d'un compte a
     * l'autre: il suit le dernier utilisateur connecte.
     */
    public function subscribe(int $userId, string $endpoint, string $publicKey, string $authToken, string $contentEncoding, ?string $userAgent): void
    {
        $hash = hash('sha256', $endpoint);
        $attributes = [
            'user_id' => $userId,
            'endpoint' => $endpoint,
            'public_key' => $publicKey,
            'auth_token' => $authToken,
            'content_encoding' => $contentEncoding,
            'user_agent' => $userAgent ? mb_substr($userAgent, 0, 500) : null,
        ];

        $existing = $this->subscriptionRepository->findFirstWhere(['endpoint_hash' => $hash]);
        if ($existing) {
            $this->subscriptionRepository->updateFromArray($existing->getId(), $attributes);
            return;
        }

        $this->subscriptionRepository->create([...$attributes, 'endpoint_hash' => $hash]);
    }

    public function unsubscribe(int $userId, string $endpoint): void
    {
        $this->subscriptionRepository->deleteWhere([
            'user_id' => $userId,
            'endpoint_hash' => hash('sha256', $endpoint),
        ]);
    }

    /**
     * Envoie une notification a tous les appareils d'un utilisateur. Un appareil desabonne (le
     * navigateur a retire la permission, l'app a ete supprimee) est oublie.
     *
     * @param array{title: string, body: string, url: string, tag?: string} $payload
     * @return int le nombre d'appareils joints
     */
    public function sendToUser(int $userId, array $payload): int
    {
        $subscriptions = $this->subscriptionRepository->findWhere(['user_id' => $userId]);
        if ($subscriptions->isEmpty()) {
            return 0;
        }

        $keys = $this->vapidKeys();

        // Sans GMP ni BCMath (nos images PHP), la bibliotheque le signale par un E_USER_NOTICE
        // qu'elle peut ignorer (calcul en PHP, plus lent); Laravel en ferait une exception.
        set_error_handler(static fn() => true, E_USER_NOTICE);
        try {
            $webPush = new WebPush(
                auth: ['VAPID' => [
                    'subject' => $this->subject(),
                    'publicKey' => $keys['publicKey'],
                    'privateKey' => $keys['privateKey'],
                ]],
                defaultOptions: ['TTL' => 86400, 'urgency' => 'high'],
                timeout: 10,
            );
        } finally {
            restore_error_handler();
        }

        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        /** @var PushSubscriptionDomainObject $subscription */
        foreach ($subscriptions as $subscription) {
            $webPush->queueNotification(Subscription::create([
                'endpoint' => $subscription->getEndpoint(),
                'publicKey' => $subscription->getPublicKey(),
                'authToken' => $subscription->getAuthToken(),
                'contentEncoding' => $subscription->getContentEncoding(),
            ]), $body);
        }

        $delivered = 0;
        foreach ($webPush->flush() as $report) {
            if ($report->isSuccess()) {
                $delivered++;
                continue;
            }

            if ($report->isSubscriptionExpired()) {
                $this->subscriptionRepository->deleteWhere([
                    'endpoint_hash' => hash('sha256', $report->getEndpoint()),
                ]);
                continue;
            }

            $this->logger->warning('Web push failed', [
                'user_id' => $userId,
                'reason' => $report->getReason(),
            ]);
        }

        return $delivered;
    }

    /**
     * @return array{publicKey: string, privateKey: string}
     */
    private function vapidKeys(): array
    {
        $row = $this->db->table('web_push_keys')->orderBy('id')->first();

        if ($row === null) {
            $keys = VAPID::createVapidKeys();
            $this->db->table('web_push_keys')->insert([
                'public_key' => $keys['publicKey'],
                'private_key' => $keys['privateKey'],
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);

            // Deux premieres demandes en meme temps: la premiere paire ecrite sert a tous.
            $row = $this->db->table('web_push_keys')->orderBy('id')->first();
        }

        return ['publicKey' => $row->public_key, 'privateKey' => $row->private_key];
    }

    /**
     * Le contact du serveur pour les services de notification (adresse du site, ou courriel).
     */
    private function subject(): string
    {
        $url = (string)$this->config->get('app.frontend_url');
        if (str_starts_with($url, 'https://')) {
            return $url;
        }

        try {
            return 'mailto:' . $this->config->get('mail.from.address');
        } catch (Throwable) {
            return 'mailto:support@dehorsqc.com';
        }
    }
}
