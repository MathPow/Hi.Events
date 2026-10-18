<?php

namespace Tests\Unit\Services\Infrastructure\Turnstile;

use HiEvents\Services\Infrastructure\Turnstile\TurnstileVerificationService;
use Illuminate\Config\Repository;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory as HttpClient;
use Illuminate\Http\Client\Request;
use Psr\Log\NullLogger;
use Tests\TestCase;

class TurnstileVerificationServiceTest extends TestCase
{
    public function testEverythingPassesWhileNoSecretKeyIsConfigured(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake();

        $service = $this->service(secretKey: null, httpClient: $httpClient);

        $this->assertFalse($service->isEnabled());
        $this->assertTrue($service->verify(null, '1.2.3.4'));
        $httpClient->assertNothingSent();
    }

    public function testAMissingTokenIsRejectedWithoutCallingCloudflare(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake();

        $this->assertFalse($this->service('secret', $httpClient)->verify('  ', '1.2.3.4'));
        $httpClient->assertNothingSent();
    }

    public function testATokenCloudflareAcceptsPasses(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake(['*' => $httpClient->response(['success' => true])]);

        $this->assertTrue($this->service('secret', $httpClient)->verify('token', '1.2.3.4'));

        $httpClient->assertSent(fn(Request $request) => $request['secret'] === 'secret'
            && $request['response'] === 'token'
            && $request['remoteip'] === '1.2.3.4');
    }

    public function testATokenCloudflareRefusesFails(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake(['*' => $httpClient->response(['success' => false, 'error-codes' => ['invalid-input-response']])]);

        $this->assertFalse($this->service('secret', $httpClient)->verify('token', '1.2.3.4'));
    }

    public function testAnUnreachableCloudflareFailsClosed(): void
    {
        $httpClient = new HttpClient();
        $httpClient->fake(fn() => throw new ConnectionException('timeout'));

        $this->assertFalse($this->service('secret', $httpClient)->verify('token', '1.2.3.4'));
    }

    private function service(?string $secretKey, HttpClient $httpClient): TurnstileVerificationService
    {
        return new TurnstileVerificationService(
            config: new Repository(['services' => ['turnstile' => ['secret_key' => $secretKey]]]),
            httpClient: $httpClient,
            logger: new NullLogger(),
        );
    }
}
