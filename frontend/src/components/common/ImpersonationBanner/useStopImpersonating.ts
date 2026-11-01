import {t} from "@lingui/macro";
import {useNavigate} from "react-router";
import {useStopImpersonation} from "../../../mutations/useStopImpersonation";
import {showError, showSuccess} from "../../../utilites/notifications";
import {useGetMe} from "../../../queries/useGetMe";

// Leaves someone else's account and goes back to the admin: from the account menu (GlobalMenu) and
// the phone menu (MobileNav).
export const useStopImpersonating = () => {
    const {data: user} = useGetMe();
    const stopImpersonationMutation = useStopImpersonation();
    const navigate = useNavigate();

    const stop = () => {
        stopImpersonationMutation.mutate(undefined, {
            onSuccess: (response) => {
                showSuccess(response.message || t`Impersonation stopped`);
                navigate(response.redirect_url || '/admin/users');
            },
            onError: (error: any) => {
                showError(
                    error?.response?.data?.message ||
                    t`Failed to stop impersonation. Please try again.`
                );
            }
        });
    };

    return {isImpersonating: !!user?.is_impersonating, stop, isPending: stopImpersonationMutation.isPending};
};
