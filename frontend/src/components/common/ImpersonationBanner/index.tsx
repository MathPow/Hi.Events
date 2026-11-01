import {useEffect} from "react";
import {useGetMe} from "../../../queries/useGetMe";

// No banner: while a super admin acts as someone else, the page is marked (html[data-impersonating])
// and the navigation turns orange (Sidebar, MobileNav), so it is never taken for their own account.
const ImpersonationMarker = () => {
    const {data: user} = useGetMe();
    const isImpersonating = !!user?.is_impersonating;

    useEffect(() => {
        document.documentElement.toggleAttribute('data-impersonating', isImpersonating);
    }, [isImpersonating]);

    return null;
};

export default ImpersonationMarker;
