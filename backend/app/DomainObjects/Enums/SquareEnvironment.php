<?php

namespace HiEvents\DomainObjects\Enums;

enum SquareEnvironment: string
{
    use BaseEnum;

    case SANDBOX = 'sandbox';
    case PRODUCTION = 'production';

    public function apiBaseUrl(): string
    {
        return match ($this) {
            self::SANDBOX => 'https://connect.squareupsandbox.com',
            self::PRODUCTION => 'https://connect.squareup.com',
        };
    }

    /**
     * Le SDK Web Payments est servi depuis un domaine different selon
     * l'environnement, et charger le mauvais fait echouer la tokenisation
     * avec une erreur peu parlante cote navigateur.
     */
    public function webPaymentsSdkUrl(): string
    {
        return match ($this) {
            self::SANDBOX => 'https://sandbox.web.squarecdn.com/v1/square.js',
            self::PRODUCTION => 'https://web.squarecdn.com/v1/square.js',
        };
    }
}
