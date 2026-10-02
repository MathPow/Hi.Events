<?php

namespace HiEvents\Services\Domain\Order;

use HiEvents\DomainObjects\AccountConfigurationDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\Helper\Currency;
use Illuminate\Config\Repository;

class OrderProcessingFeePassThroughService
{
    public const PROCESSING_FEE_ID = -1;

    public static function getProcessingFeeName(): string
    {
        return __('Processing Fee');
    }

    public function __construct(
        private readonly Repository                         $config,
        private readonly OrderPlatformFeePassThroughService $platformFeeService,
    )
    {
    }

    public function isEnabled(EventSettingDomainObject $eventSettings): bool
    {
        return (bool)$eventSettings->getPassProcessingFeeToBuyer();
    }

    /**
     * Gross-up so the organizer nets what they would have without passing the fee on.
     *
     * Stripe takes r_s * T + f_s * q, and in SaaS mode the platform takes r_p * T + f_p * q,
     * both on the final total T. Solving for T:
     * - platform fee also passed:   T = (B + (f_p + f_s) * q) / (1 - r_p - r_s)
     * - platform fee absorbed:      T = (B * (1 - r_p) + f_s * q) / (1 - r_p - r_s)
     * The processing fee is T - B, minus the platform fee line when that one is passed too.
     */
    public function calculateProcessingFee(
        AccountConfigurationDomainObject $accountConfiguration,
        EventSettingDomainObject         $eventSettings,
        float                            $total,
        int                              $quantity,
        string                           $currency,
        float                            $platformFee = 0.0,
        ?bool                            $platformFeePassed = null,
    ): float
    {
        if (!$this->isEnabled($eventSettings) || $total <= 0) {
            return 0.0;
        }

        $stripeRate = (float)$this->config->get('services.stripe.processing_fee_percentage', 0) / 100;
        $stripeFixed = (float)$this->config->get('services.stripe.processing_fee_fixed', 0) * $quantity;

        $platformRate = 0.0;
        $platformFixed = 0.0;

        if ($this->config->get('app.saas_mode_enabled')) {
            $platformRate = $accountConfiguration->getPercentageApplicationFee() / 100;
            $platformFixed = $this->platformFeeService->getConvertedFixedFee($accountConfiguration, $currency) * $quantity;
        }

        $denominator = 1 - $platformRate - $stripeRate;

        if ($denominator <= 0) {
            return Currency::round($stripeFixed + ($total * $stripeRate));
        }

        $grossTotal = ($platformFeePassed ?? $this->platformFeeService->isEnabled($eventSettings))
            ? ($total + $platformFixed + $stripeFixed) / $denominator
            : (($total * (1 - $platformRate)) + $stripeFixed) / $denominator;

        return max(0.0, Currency::round($grossTotal - $total - $platformFee));
    }
}
