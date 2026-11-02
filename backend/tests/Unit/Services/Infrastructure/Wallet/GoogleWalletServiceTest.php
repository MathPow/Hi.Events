<?php

namespace Tests\Unit\Services\Infrastructure\Wallet;

use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Services\Infrastructure\Wallet\GoogleWalletService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GoogleWalletServiceTest extends TestCase
{
    use WalletTestData;

    private const API = 'https://walletobjects.googleapis.com/walletobjects/v1';

    private mixed $publicKey;

    protected function setUp(): void
    {
        parent::setUp();

        [, $keyPem, $key] = $this->selfSignedPem();
        $this->publicKey = openssl_pkey_get_details($key)['key'];

        config([
            'app.frontend_url' => 'https://billets.dehorsqc.com',
            'services.google_wallet' => [
                'issuer_id' => '3388000000012345678',
                'service_account' => base64_encode(json_encode([
                    'client_email' => 'wallet@dehors.iam.gserviceaccount.com',
                    'private_key' => $keyPem,
                ])),
            ],
        ]);
        Storage::fake(config('filesystems.public'));
        Cache::flush();
        app()->setLocale('fr');
    }

    public function testWritesTheEventAndTheTicketsThenSignsTheLink(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'token-1', 'expires_in' => 3600]),
            self::API . '/eventTicketClass' => Http::response(['error' => 'exists'], 409),
            self::API . '/eventTicketClass/*' => Http::response(['id' => 'class']),
            self::API . '/eventTicketObject' => Http::response(['id' => 'object']),
        ]);

        $url = app(GoogleWalletService::class)->saveUrl($this->walletOrder(tickets: 2));

        $classId = '3388000000012345678.billets-dehorsqc-com-event-11';
        Http::assertSent(fn(Request $request) => $request->method() === 'PUT'
            && $request->url() === self::API . '/eventTicketClass/' . rawurlencode($classId)
            && $request->hasHeader('Authorization', 'Bearer token-1')
            && $request['eventName']['defaultValue'] === ['language' => 'fr', 'value' => 'Backyard Boréal']
            && $request['hexBackgroundColor'] === '#1d6fd8'
            && $request['venue']['name']['defaultValue']['value'] === 'Mont Orford'
            && $request['dateTime']['start'] === '2030-10-26T08:00:00-04:00'
            && str_ends_with($request['logo']['sourceUri']['uri'], 'wallet/dehors-logo-v1.png'));
        Http::assertSent(fn(Request $request) => $request->method() === 'POST'
            && $request->url() === self::API . '/eventTicketObject'
            && $request['id'] === '3388000000012345678.billets-dehorsqc-com-ticket-42'
            && $request['classId'] === $classId
            && $request['barcode'] === ['type' => 'QR_CODE', 'value' => 'A-TICKET2', 'alternateText' => 'A-TICKET2']
            && $request['ticketHolderName'] === 'Léa Tremblay 2'
            && $request['reservationInfo']['confirmationCode'] === 'O-123');
        Storage::disk(config('filesystems.public'))->assertExists('wallet/dehors-logo-v1.png');

        $this->assertStringStartsWith('https://pay.google.com/gp/v/save/', $url);
        [$header, $payload, $signature] = explode('.', substr($url, strlen('https://pay.google.com/gp/v/save/')));
        $this->assertSame(1, openssl_verify("$header.$payload", $this->base64UrlDecode($signature), $this->publicKey, OPENSSL_ALGO_SHA256));

        $claims = json_decode($this->base64UrlDecode($payload), true);
        $this->assertSame('wallet@dehors.iam.gserviceaccount.com', $claims['iss']);
        $this->assertSame('savetowallet', $claims['typ']);
        $this->assertSame(['https://billets.dehorsqc.com'], $claims['origins']);
        $this->assertSame([
            ['id' => '3388000000012345678.billets-dehorsqc-com-ticket-41'],
            ['id' => '3388000000012345678.billets-dehorsqc-com-ticket-42'],
        ], $claims['payload']['eventTicketObjects']);
    }

    public function testARefusalFromGoogleFails(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'token-1']),
            self::API . '/*' => Http::response(['error' => ['message' => 'Invalid issuer']], 403),
        ]);

        $this->expectException(WalletPassFailedException::class);
        app(GoogleWalletService::class)->saveUrl($this->walletOrder());
    }

    private function base64UrlDecode(string $value): string
    {
        return base64_decode(strtr($value, '-_', '+/'));
    }
}
