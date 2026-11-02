<?php

namespace Tests\Unit\Services\Infrastructure\Wallet;

use HiEvents\Services\Domain\Wallet\DTO\WalletEventDTO;
use HiEvents\Services\Domain\Wallet\DTO\WalletOrderDTO;
use HiEvents\Services\Domain\Wallet\DTO\WalletTicketDTO;

trait WalletTestData
{
    /** A throwaway certificate: the pass is signed like with Apple's, without Apple. */
    private function selfSignedPem(): array
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $certificate = openssl_csr_sign(openssl_csr_new(['commonName' => 'Pass Type ID: pass.test.dehors'], $key), null, $key, 1);
        openssl_x509_export($certificate, $certificatePem);
        openssl_pkey_export($key, $keyPem);

        return [$certificatePem, $keyPem, $key, $certificate];
    }

    private function walletOrder(int $tickets = 1): WalletOrderDTO
    {
        return new WalletOrderDTO(
            orderPublicId: 'O-123',
            locale: 'fr',
            event: new WalletEventDTO(
                eventId: 11,
                title: 'Backyard Boréal',
                organizerName: 'Boréal',
                supportEmail: 'info@boreal.ca',
                eventUrl: 'https://billets.example.com/event/11/backyard-boreal',
                backgroundColor: '#1d6fd8',
                foregroundColor: '#fffcf8',
                labelColor: '#d2dff1',
                startDate: '2030-10-26T08:00:00-04:00',
                endDate: '2030-10-26T16:00:00-04:00',
                shortDate: '26 oct.',
                dateTimeLine: 'Sam. 26 oct. · 08:00',
                dateLine: 'Samedi 26 octobre 2030 · 08:00 → 16:00',
                timezoneLine: 'Heure de l’Est (HAE)',
                placeLine: 'Mont Orford',
                addressLine: '4380 chemin du Parc, Orford, QC',
                logo: null,
                cover: null,
            ),
            tickets: array_map(fn(int $i) => new WalletTicketDTO(
                attendeeId: 40 + $i,
                publicId: "A-TICKET$i",
                holderName: "Léa Tremblay $i",
                ticketName: 'Admission générale',
            ), range(1, $tickets)),
        );
    }

    /** @return array<string, string> */
    private function unzip(string $content): array
    {
        $path = tempnam(sys_get_temp_dir(), 'zip');
        file_put_contents($path, $content);
        $zip = new \ZipArchive();
        $zip->open($path);

        $files = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            $files[$name] = $zip->getFromIndex($i);
        }
        $zip->close();
        unlink($path);

        return $files;
    }
}
