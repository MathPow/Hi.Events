import React, { useState, useEffect } from 'react';
import { Button } from '@mantine/core';
import { IconBrandStripe } from '@tabler/icons-react';
import { t } from '@lingui/macro';
import { useCreateOrGetStripeConnectDetails } from '../../../queries/useCreateOrGetStripeConnectDetails';
import { useGetAccount } from '../../../queries/useGetAccount';
import { showError, showSuccess } from '../../../utilites/notifications';
import { isHiEvents } from '../../../utilites/helpers';

interface StripeConnectButtonProps {
    buttonText?: string;
    buttonIcon?: React.ReactNode;
    variant?: string;
    size?: string;
    fullWidth?: boolean;
    className?: string;
    platform?: string;
}

export const StripeConnectButton: React.FC<StripeConnectButtonProps> = ({
    buttonText,
    buttonIcon = <IconBrandStripe size={20} />,
    variant = 'light',
    size = 'sm',
    fullWidth = false,
    className,
    platform
}) => {
    const [fetchStripeDetails, setFetchStripeDetails] = useState(false);
    const [isReturningFromStripe, setIsReturningFromStripe] = useState(false);
    const accountQuery = useGetAccount();
    const account = accountQuery.data;
    
    // For Hi.Events, use the new platform parameter for Ireland migration
    // For open-source, use existing logic (no platform parameter)
    const platformToUse = isHiEvents() ? platform || 'ie' : undefined;
    
    const stripeDetailsQuery = useCreateOrGetStripeConnectDetails(
        account?.id || '',
        (!!account?.stripe_account_id || fetchStripeDetails) && !!account?.id,
        platformToUse
    );

    const stripeDetails = stripeDetailsQuery.data;

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        setIsReturningFromStripe(
            window.location.search.includes('is_return') || 
            window.location.search.includes('is_refresh')
        );
    }, []);

    useEffect(() => {
        if (fetchStripeDetails && !stripeDetailsQuery.isLoading && stripeDetails) {
            setFetchStripeDetails(false);
            showSuccess(t`Redirecting to Stripe...`);
            window.location.href = String(stripeDetails.connect_url);
        }
    }, [fetchStripeDetails, stripeDetailsQuery.isLoading, stripeDetails]);

    // Sans ca, un 500 cote Stripe (Connect pas active sur le compte, cle live
    // invalide...) laisse le bouton muet: on clique, rien ne bouge, aucune piste.
    useEffect(() => {
        if (!fetchStripeDetails || !stripeDetailsQuery.isError) {
            return;
        }
        setFetchStripeDetails(false);
        const data = stripeDetailsQuery.error?.response?.data as { message?: string } | undefined;
        showError(data?.message ?? t`Unable to reach Stripe. Please try again.`);
    }, [fetchStripeDetails, stripeDetailsQuery.isError, stripeDetailsQuery.error]);

    const handleClick = () => {
        if (!stripeDetails) {
            setFetchStripeDetails(true);
        } else {
            if (stripeDetails.is_connect_setup_complete) {
                showSuccess(t`Stripe setup is already complete.`);
                return;
            }

            if (typeof window !== 'undefined') {
                showSuccess(t`Redirecting to Stripe...`);
                window.location.href = String(stripeDetails.connect_url);
            }
        }
    };

    // Determine button text
    const getButtonText = () => {
        if (buttonText) return buttonText;
        
        if (!isReturningFromStripe && !account?.stripe_account_id) {
            return t`Connect with Stripe`;
        }
        return t`Complete Stripe Setup`;
    };

    return (
        <Button
            variant={variant}
            size={size}
            fullWidth={fullWidth}
            leftSection={buttonIcon}
            onClick={handleClick}
            className={className}
            loading={stripeDetailsQuery.isLoading}
        >
            {getButtonText()}
        </Button>
    );
};
