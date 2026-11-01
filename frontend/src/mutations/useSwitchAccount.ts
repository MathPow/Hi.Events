import {useMutation} from "@tanstack/react-query";
import {t} from "@lingui/macro";
import {authClient} from "../api/auth.client.ts";
import {setAuthToken} from "../utilites/apiClient.ts";
import {showError} from "../utilites/notifications.tsx";

// Opens another account: the new session replaces the current one, then the app starts again on
// it (its organizers, its data), on the last organizer opened there or its first one.
export const useSwitchAccount = () => {
    return useMutation({
        mutationFn: (accountId: number) => authClient.switchAccount(accountId),
        onSuccess: ({token}) => {
            try {
                localStorage.setItem('token', token);
            } catch {
                // localStorage unavailable: the cookie set by the server still carries the session
            }
            setAuthToken(token);
            window.location.href = '/manage/events';
        },
        // Here, not at the call: the menu that started it has closed by then.
        onError: (error: any) => {
            const errors = error?.response?.data?.errors;
            showError(errors?.account_id?.[0] ?? error?.response?.data?.message ?? t`Something went wrong. Please try again.`);
        },
    });
};
