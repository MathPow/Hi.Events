<?php

namespace Tests\Unit\Services\Infrastructure\WebPage;

use HiEvents\Services\Infrastructure\WebPage\SafeWebFetcher;
use HiEvents\Services\Infrastructure\WebPage\UnsafeUrlException;
use Tests\TestCase;

class SafeWebFetcherTest extends TestCase
{
    public function testOnlyPublicAddressesAreAllowed(): void
    {
        $fetcher = new SafeWebFetcher();

        foreach (['127.0.0.1', '10.0.0.5', '172.16.3.4', '192.168.1.127', '169.254.169.254', '100.87.10.111', '0.0.0.0', '::1', 'fd7a:115c:a1e0::1', 'fe80::1'] as $ip) {
            $this->assertFalse($fetcher->isPublic($ip), $ip);
        }
        foreach (['8.8.8.8', '104.16.1.1', '2606:4700:4700::1111'] as $ip) {
            $this->assertTrue($fetcher->isPublic($ip), $ip);
        }
    }

    public function testAnInternalAddressIsRefusedBeforeAnyRequest(): void
    {
        $this->expectException(UnsafeUrlException::class);

        (new SafeWebFetcher())->publicAddress('127.0.0.1');
    }

    public function testAddressesAreNormalized(): void
    {
        $fetcher = new SafeWebFetcher();

        $this->assertSame('https://dehorsqc.com', $fetcher->normalize(' dehorsqc.com '));
        $this->assertSame('http://example.com/a?b=1', $fetcher->normalize('http://example.com/a?b=1'));
    }

    public function testOtherSchemesCredentialsAndPortsAreRefused(): void
    {
        $fetcher = new SafeWebFetcher();

        foreach (['ftp://example.com', 'https://user:secret@example.com', 'https://example.com:8080/', 'file:///etc/passwd', 'gopher://x'] as $url) {
            try {
                $fetcher->normalize($url);
                $this->fail("$url was accepted");
            } catch (UnsafeUrlException) {
                $this->addToAssertionCount(1);
            }
        }
    }
}
