import {Button, Stack, Text} from "@mantine/core";
import {t} from "@lingui/macro";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {useResendEmailConfirmation} from "../../../mutations/useResendEmailConfirmation.ts";
import {showError} from "../../../utilites/notifications.tsx";

// Le contenu de la notification: ce qu'il faut faire, et le bouton qui renvoie le lien sur place.
const EmailNotConfirmedNotice = () => {
    const {data: me} = useGetMe();
    const resend = useResendEmailConfirmation();

    return (
        <Stack gap={8} align={'flex-start'}>
            <Text size={'sm'} fw={700}>{t`Confirm your email address first`}</Text>
            {me?.email && <Text size={'sm'}>{t`Click the link we sent to ${me.email}, then try again.`}</Text>}
            {resend.isSuccess ? (
                <Text size={'sm'} fw={700}>{t`Email confirmation resent successfully`}</Text>
            ) : (
                <Button size={'xs'} variant={'outline'} loading={resend.isPending} disabled={!me?.id}
                        onClick={() => me?.id && resend.mutate({userId: me.id})}>
                    {t`Resend Confirmation`}
                </Button>
            )}
            {resend.isError && <Text size={'sm'}>{t`Something went wrong. Please try again.`}</Text>}
        </Stack>
    );
};

/**
 * L'erreur d'un changement de statut (publier, archiver). Tant que le courriel n'est pas
 * confirme, l'API refuse avec le code email_not_confirmed: la notification reste ouverte
 * et porte le bouton qui renvoie le lien, au lieu de dire d'aller le chercher dans le profil.
 */
export const showStatusChangeError = (error: any, fallback: string) => {
    if (error?.response?.data?.errors?.code === 'email_not_confirmed') {
        showError(<EmailNotConfirmedNotice/>, undefined, false);
        return;
    }

    showError(error?.response?.data?.message || fallback);
};
