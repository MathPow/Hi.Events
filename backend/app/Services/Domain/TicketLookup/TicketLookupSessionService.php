<?php

namespace HiEvents\Services\Domain\TicketLookup;

use Carbon\Carbon;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * « Mes billets » remembers a buyer with an encrypted, HttpOnly cookie holding their email and
 * its expiry, set once the emailed link is opened. The link itself is not kept anywhere.
 */
class TicketLookupSessionService
{
    public const COOKIE = 'dehors_billets';

    private const DAYS = 30;

    public function __construct(
        private readonly Encrypter $encrypter,
    ) {
    }

    public function makeCookie(string $email, Request $request): Cookie
    {
        $expiresAt = Carbon::now()->addDays(self::DAYS);
        $value = $this->encrypter->encryptString(json_encode([
            'email' => strtolower($email),
            'expires_at' => $expiresAt->getTimestamp(),
        ], JSON_THROW_ON_ERROR));

        return $this->cookie($value, self::DAYS * 24 * 60, $request);
    }

    public function forgetCookie(Request $request): Cookie
    {
        return $this->cookie('', -2628000, $request);
    }

    public function emailFrom(Request $request): ?string
    {
        $value = $request->cookie(self::COOKIE);

        if (!is_string($value) || $value === '') {
            return null;
        }

        try {
            $payload = json_decode($this->encrypter->decryptString($value), true, 512, JSON_THROW_ON_ERROR);
        } catch (DecryptException|\JsonException) {
            return null;
        }

        if (!is_array($payload)
            || !is_string($payload['email'] ?? null)
            || !is_int($payload['expires_at'] ?? null)
            || $payload['expires_at'] <= Carbon::now()->getTimestamp()) {
            return null;
        }

        return $payload['email'];
    }

    private function cookie(string $value, int $minutes, Request $request): Cookie
    {
        return Cookie::create(
            name: self::COOKIE,
            value: $value,
            expire: $minutes > 0 ? Carbon::now()->addMinutes($minutes) : 1,
            path: '/',
            secure: $request->isSecure(),
            httpOnly: true,
            raw: false,
            sameSite: Cookie::SAMESITE_LAX,
        );
    }
}
