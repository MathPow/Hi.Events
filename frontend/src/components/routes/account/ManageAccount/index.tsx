import {Tabs} from "@mantine/core";
import classes from "./ManageAccount.module.scss";
import {IconAdjustmentsCog, IconCreditCard, IconKey, IconReceiptTax, IconUsers} from "@tabler/icons-react";
import {Outlet, useLocation, useNavigate} from "react-router";
import {t} from "@lingui/macro";
import {useCanSeeDeveloperPages, useIsCurrentUserAdmin} from "../../../../hooks/useIsCurrentUserAdmin.ts";
import { useGetAccount } from "../../../../queries/useGetAccount.ts";
import {useEffect, useRef} from "react";

export const ManageAccount = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const tabValue = location.pathname.split('/').pop() || 'settings';
    const isUserAdmin = useIsCurrentUserAdmin();
    const canSeeDeveloperPages = useCanSeeDeveloperPages();
    const {data: account} = useGetAccount();
    const tabsListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const list = tabsListRef.current;
        const activeTab = list?.querySelector<HTMLElement>('[data-active]');
        if (!list || !activeTab) {
            return;
        }
        const offset = activeTab.getBoundingClientRect().left - list.getBoundingClientRect().left;
        list.scrollTo({left: list.scrollLeft + offset - (list.clientWidth - activeTab.offsetWidth) / 2});
    }, [tabValue, isUserAdmin]);

    return (
        <div className={classes.container}>
            <h1 className={classes.title}>{t`Account Settings`}</h1>
            <Tabs
                variant={'pills'}
                className={classes.tabs}
                value={tabValue}
                onChange={(value) => navigate(`/account/${value}`)}
            >
                <Tabs.List ref={tabsListRef}>
                    <Tabs.Tab value="settings" leftSection={<IconAdjustmentsCog/>}>
                        {t`Account`}
                    </Tabs.Tab>
                    <Tabs.Tab value="taxes-and-fees" leftSection={<IconReceiptTax/>}>
                        {t`Tax & Fees`}
                    </Tabs.Tab>

                    {isUserAdmin && (
                        <Tabs.Tab value="users" leftSection={<IconUsers/>}>
                            {t`Users`}
                        </Tabs.Tab>
                    )}

                    {(isUserAdmin && canSeeDeveloperPages) && (
                        <Tabs.Tab value="api-tokens" leftSection={<IconKey/>}>
                            {t`API tokens`}
                        </Tabs.Tab>
                    )}

                    {(isUserAdmin && account && account.is_saas_mode_enabled) && (
                        <Tabs.Tab value="payment" leftSection={<IconCreditCard/>}>
                            {t`Payment & Plan`}
                        </Tabs.Tab>
                    )}
                </Tabs.List>
            </Tabs>
            <div className={classes.tabWrapper}>
                <Outlet/>
            </div>
        </div>
    );
};

export default ManageAccount;
