<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Wallet;

use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Services\Infrastructure\Wallet\DTO\AppleSigningCredentialsDTO;
use HiEvents\Services\Infrastructure\Wallet\DTO\GoogleServiceAccountDTO;
use Illuminate\Config\Repository;

/**
 * The Apple and Google accounts that sign the passes (config/services.php). A wallet without its
 * account stays hidden.
 */
class WalletConfig
{
    public function __construct(
        private readonly Repository $config,
    )
    {
    }

    public function isAppleEnabled(): bool
    {
        return filled($this->config->get('services.apple_wallet.pass_type_identifier'))
            && filled($this->config->get('services.apple_wallet.team_identifier'))
            && filled($this->config->get('services.apple_wallet.certificate'));
    }

    public function isGoogleEnabled(): bool
    {
        return filled($this->config->get('services.google_wallet.issuer_id'))
            && filled($this->config->get('services.google_wallet.service_account'));
    }

    public function applePassTypeIdentifier(): string
    {
        return (string)$this->config->get('services.apple_wallet.pass_type_identifier');
    }

    public function appleTeamIdentifier(): string
    {
        return (string)$this->config->get('services.apple_wallet.team_identifier');
    }

    /**
     * The certificate of the pass type: a .p12 or a PEM (certificate + key), in base64 or as is.
     *
     * @throws WalletPassFailedException
     */
    public function appleSigningCredentials(): AppleSigningCredentialsDTO
    {
        $raw = trim((string)$this->config->get('services.apple_wallet.certificate'));
        $password = (string)$this->config->get('services.apple_wallet.certificate_password');
        $content = str_contains($raw, '-----BEGIN') ? $raw : base64_decode($raw, true);

        if ($content === false || $content === '') {
            throw new WalletPassFailedException('APPLE_WALLET_CERTIFICATE is not valid base64');
        }

        if (str_contains($content, '-----BEGIN')) {
            $certificate = openssl_x509_read($content);
            $key = openssl_pkey_get_private($content, $password);
            if ($certificate === false || $key === false) {
                throw new WalletPassFailedException('APPLE_WALLET_CERTIFICATE: the PEM needs the certificate and its private key');
            }
            openssl_x509_export($certificate, $certificatePem);
            openssl_pkey_export($key, $keyPem);

            return new AppleSigningCredentialsDTO(certificate: $certificatePem, privateKey: $keyPem);
        }

        $certificates = [];
        if (!openssl_pkcs12_read($content, $certificates, $password)) {
            throw new WalletPassFailedException(
                'APPLE_WALLET_CERTIFICATE: the .p12 cannot be read (wrong password, or an old format: '
                . 'convert it with « openssl pkcs12 -legacy -in pass.p12 -nodes -out pass.pem »)'
            );
        }

        return new AppleSigningCredentialsDTO(certificate: $certificates['cert'], privateKey: $certificates['pkey']);
    }

    /** Apple's intermediate certificate, public, valid until 2030. */
    public function appleIntermediateCertificatePath(): string
    {
        return resource_path('wallet/AppleWWDRCAG4.pem');
    }

    public function googleIssuerId(): string
    {
        return (string)$this->config->get('services.google_wallet.issuer_id');
    }

    /**
     * The JSON key of the service account, in base64 or as is.
     *
     * @throws WalletPassFailedException
     */
    public function googleServiceAccount(): GoogleServiceAccountDTO
    {
        $raw = trim((string)$this->config->get('services.google_wallet.service_account'));
        $json = str_starts_with($raw, '{') ? $raw : base64_decode($raw, true);
        $key = is_string($json) ? json_decode($json, true) : null;

        if (!is_array($key) || empty($key['client_email']) || empty($key['private_key'])) {
            throw new WalletPassFailedException('GOOGLE_WALLET_SERVICE_ACCOUNT is not a service account JSON key');
        }

        return new GoogleServiceAccountDTO(clientEmail: $key['client_email'], privateKey: $key['private_key']);
    }

    /**
     * Prefix of the Google ids: dev and prod can share the issuer without mixing their events.
     * « billets-dehorsqc-com ».
     */
    public function googleResourcePrefix(): string
    {
        $host = parse_url((string)$this->config->get('app.frontend_url'), PHP_URL_HOST) ?: 'hi-events';

        return trim((string)preg_replace('/[^a-z0-9]+/', '-', strtolower($host)), '-');
    }

    public function frontendUrl(): string
    {
        return rtrim((string)$this->config->get('app.frontend_url'), '/');
    }
}
