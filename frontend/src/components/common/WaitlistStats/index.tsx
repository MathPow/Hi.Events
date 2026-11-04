import {WaitlistStats as WaitlistStatsType} from "../../../types.ts";
import {t} from "@lingui/macro";
import {IconCircleCheck, IconHourglass, IconListNumbers, IconSend} from "@tabler/icons-react";
import {StatGrid, StatTile} from "../StatBoxes";
import {formatNumber} from "../../../utilites/helpers.ts";

interface WaitlistStatsProps {
    stats?: WaitlistStatsType;
    className?: string;
}

// The waitlist's figures as the compact tiles of the dashboards.
export const WaitlistStatsCards = ({stats, className}: WaitlistStatsProps) => (
    <StatGrid compact className={className}>
        <StatTile tone="neutral" icon={<IconListNumbers stroke={2}/>} label={t`Total Entries`}
                  loading={!stats} value={formatNumber(stats?.total ?? 0)}/>
        <StatTile tone="attendees" icon={<IconHourglass stroke={2}/>} label={t`Waiting`}
                  loading={!stats} value={formatNumber(stats?.waiting ?? 0)}/>
        <StatTile tone="products" icon={<IconSend stroke={2}/>} label={t`Offered`}
                  loading={!stats} value={formatNumber(stats?.offered ?? 0)}/>
        <StatTile tone="sales" icon={<IconCircleCheck stroke={2}/>} label={t`Purchased`}
                  loading={!stats} value={formatNumber(stats?.purchased ?? 0)}/>
    </StatGrid>
);
