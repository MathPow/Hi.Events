<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'square' => [
        // Identifiants de l'application Square (Developer Dashboard > Credentials).
        // L'application est celle de la PLATEFORME: chaque organisateur y branche
        // ensuite son propre compte marchand via OAuth.
        'application_id' => env('SQUARE_APPLICATION_ID'),
        'application_secret' => env('SQUARE_APPLICATION_SECRET'),
        'webhook_signature_key' => env('SQUARE_WEBHOOK_SIGNATURE_KEY'),
        // 'sandbox' ou 'production'. Determine l'URL de l'API ET celle du SDK
        // Web Payments servi au navigateur.
        'environment' => env('SQUARE_ENVIRONMENT', 'production'),
        // Version d'API epinglee: Square fait evoluer ses reponses et une version
        // flottante casserait le parsing sans previsibilite.
        'api_version' => env('SQUARE_API_VERSION', '2025-01-23'),
        // Repli mono-compte (installation open source sans OAuth): jeton d'acces
        // et point de vente d'un seul marchand.
        'access_token' => env('SQUARE_ACCESS_TOKEN'),
        'location_id' => env('SQUARE_LOCATION_ID'),
    ],

    'stripe' => [
        'secret_key' => env('STRIPE_SECRET_KEY'),
        'public_key' => env('STRIPE_PUBLIC_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),

        // Part variable des frais Stripe, en pourcentage. Sert a facturer a la
        // plateforme le cout de traitement de la contribution volontaire, pour
        // que celle-ci ne coute rien a l'organisateur. La part fixe (0,30 $) est
        // due de toute facon, contribution ou pas: elle reste a l'organisateur.
        'processing_fee_percentage' => env('STRIPE_PROCESSING_FEE_PERCENTAGE', 2.9),

        // Canadian platform (Optional)
        'ca_secret_key' => env('STRIPE_CA_SECRET_KEY', env('STRIPE_SECRET_KEY')),
        'ca_public_key' => env('STRIPE_CA_PUBLIC_KEY', env('STRIPE_PUBLIC_KEY')),
        'ca_webhook_secret' => env('STRIPE_CA_WEBHOOK_SECRET', env('STRIPE_WEBHOOK_SECRET')),

        // Irish platform (Optional)
        'ie_secret_key' => env('STRIPE_IE_SECRET_KEY', env('STRIPE_SECRET_KEY')),
        'ie_public_key' => env('STRIPE_IE_PUBLIC_KEY', env('STRIPE_PUBLIC_KEY')),
        'ie_webhook_secret' => env('STRIPE_IE_WEBHOOK_SECRET', env('STRIPE_WEBHOOK_SECRET')),

        // Primary platform for new organizers
        'primary_platform' => env('STRIPE_PRIMARY_PLATFORM'),
    ],
    'open_exchange_rates' => [
        'app_id' => env('OPEN_EXCHANGE_RATES_APP_ID'),
    ],
];
