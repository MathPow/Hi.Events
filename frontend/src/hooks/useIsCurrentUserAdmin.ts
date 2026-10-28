import {useGetMe} from "../queries/useGetMe.ts";

export const useIsCurrentUserAdmin = () => {
    const {data: user, isFetched} = useGetMe();
    return isFetched && (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN');
}

export const useIsCurrentUserSuperAdmin = () => {
    const {data: user, isFetched} = useGetMe();
    return isFetched && user?.role === 'SUPERADMIN';
}

// Les pages de developpeur (webhooks, jetons d'API) ne servent qu'au super admin,
// y compris quand il prend l'identite d'un organisateur: seul un super admin peut
// le faire, et son role devient alors celui de l'organisateur.
export const useCanSeeDeveloperPages = () => {
    const {data: user, isFetched} = useGetMe();
    return isFetched && (user?.role === 'SUPERADMIN' || !!user?.is_impersonating);
}
