import {CSSProperties, ReactNode} from "react";
import {Skeleton} from "@mantine/core";
import {t} from "@lingui/macro";
import classNames from "classnames";
import {ListRowsSkeleton, SkeletonCircle, SkeletonLine, SkeletonPill} from "../../../../common/Skeletons";
import {SettingsCard} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

const frameStyle = (height: number): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    height,
    padding: '0 1.125rem',
    borderRadius: '1rem',
    background: 'var(--dehors-champ)',
});

// A field while its value loads: its real label (and hint), the empty field, a short placeholder in it.
const Field = ({label, description, height = 56, span, valueWidth}: {
    label: ReactNode,
    description?: ReactNode,
    height?: number,
    span?: boolean,
    valueWidth?: string,
}) => (
    <div className={classNames(classes.field, {[classes.fieldsSpan]: span})}>
        <div style={{marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 700}}>{label}</div>
        {description && <div style={{margin: '-0.25rem 0 0.5rem', fontSize: '0.8125rem'}}>{description}</div>}
        <div style={frameStyle(height)}>
            {valueWidth && <SkeletonLine width={valueWidth} height={12}/>}
        </div>
    </div>
);

const ButtonSkeleton = ({width = 200, full}: { width?: number, full?: boolean }) => (
    <Skeleton width={full ? '100%' : width} height={46} radius={999}/>
);

export const OrganizationTabSkeleton = () => (
    <div className={classes.grid} aria-busy>
        <SettingsCard full title={t`Basic info`} subtitle={t`Shown on your public page and in emails.`}>
            <div className={classes.fields}>
                <Field label={t`Organizer Name`} valueWidth="34%"/>
                <Field label={t`Phone`}/>
                <Field label={t`Contact email`} valueWidth="58%"/>
                <Field label={t`Website`}/>
                <Field span label={t`Description`} height={116}/>
                <Field label={t`Currency`} valueWidth="46%"/>
                <Field label={t`Timezone`} valueWidth="40%"/>
            </div>
        </SettingsCard>
        <SettingsCard title={t`Address`} subtitle={t`The place name and the city are shown on your public page.`}>
            <div className={classes.fields}>
                <Field span label={t`Office or venue name`}/>
                <Field span label={t`Address`}/>
                <Field label={t`City`}/>
                <Field label={t`Postal code`}/>
            </div>
        </SettingsCard>
        <SettingsCard title={t`Social networks`} subtitle={t`Shown on your page. Their order is set in My page.`}>
            {[0, 1, 2].map(index => (
                <div key={index} className={classes.socialRow}>
                    <SkeletonCircle size={40}/>
                    <div style={{...frameStyle(48), flex: 1}}>
                        <SkeletonLine width={['42%', '56%', '36%'][index]} height={12}/>
                    </div>
                </div>
            ))}
        </SettingsCard>
    </div>
);

export const PaymentsTabSkeleton = () => (
    <div className={classes.grid} aria-busy>
        <SettingsCard title={t`Stripe account`} subtitle={t`Where the money from your sales goes.`}>
            <Skeleton height={326} radius={24}/>
            <div className={classes.cardBody} style={{gap: 10}}>
                <SkeletonLine width="92%" height={12}/>
                <SkeletonLine width="48%" height={12}/>
            </div>
            <ButtonSkeleton full/>
        </SettingsCard>
        <SettingsCard title={t`Ticketing fees`}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 8, marginTop: '-0.625rem'}}>
                <SkeletonLine width="90%" height={12}/>
                <SkeletonLine width="22%" height={12}/>
            </div>
            <p className={classes.fieldLabel}>{t`Who pays the fees?`}</p>
            <div className={classes.feeOptions}>
                {[t`Absorb the fees`, t`Pass on to the buyer`].map(title => (
                    <div key={title} className={classes.feeOption} style={{cursor: 'default'}}>
                        <span className={classes.radio}/>
                        <span className={classes.feeOptionBody}>
                            <span className={classes.feeOptionTitle}>{title}</span>
                            <SkeletonLine width="86%" height={10}/>
                            <SkeletonLine width="34%" height={10}/>
                            <span className={classes.feeExample}>
                                {[t`Ticket`, t`Buyer pays`, t`You receive`].map(label => (
                                    <span key={label} className={classes.feeFigure}>
                                        <span className={classes.feeFigureLabel}>{label}</span>
                                        <SkeletonLine width={56} height={16}/>
                                    </span>
                                ))}
                            </span>
                        </span>
                    </div>
                ))}
            </div>
        </SettingsCard>
    </div>
);

export const TaxesTabSkeleton = () => (
    <div className={`${classes.grid} ${classes.gridTop}`} aria-busy>
        <SettingsCard
            title={t`Taxes and fees`}
            subtitle={t`Added to the price of the products you choose, in all your events.`}
        >
            <ListRowsSkeleton rows={2} leading="none" trailing={['pill', 'menu']}/>
            <ButtonSkeleton width={260}/>
        </SettingsCard>
        <SettingsCard
            title={t`Tax receipts`}
            subtitle={t`Issue official donation receipts for the charitable portion of an order.`}
        >
            <Field label={t`Charity registration number`}
                   description={t`Turns receipts on. Example: 123456789 RR0001`}/>
            <Field label={t`Legal name of the charity`}
                   description={t`As registered. Defaults to the organizer name if left empty.`}/>
            <Field label={t`Address`}
                   description={t`Printed on the receipt. The last line is used as the place of issue.`}
                   height={96}/>
        </SettingsCard>
    </div>
);

export const TeamTabSkeleton = ({showTokens}: { showTokens: boolean }) => (
    <div className={`${classes.grid} ${classes.gridTop}`} aria-busy>
        <SettingsCard
            full
            title={t`Team members`}
            subtitle={t`An Administrator has access to everything; an Organizer manages the events and the tickets.`}
            action={<SkeletonPill width={214} height={46}/>}
        >
            <ListRowsSkeleton rows={1} leading="circle" trailing={['pill', 'menu']}/>
        </SettingsCard>
        <SettingsCard title={t`Account`} subtitle={t`Your account name is used on event pages and in emails.`}>
            <Field label={t`Account Name`} valueWidth="30%"/>
            <Field label={t`Currency`} description={t`The default currency for your events.`} valueWidth="46%"/>
            <Field label={t`Timezone`} description={t`The default timezone for your events.`} valueWidth="40%"/>
        </SettingsCard>
        {showTokens && (
            <SettingsCard
                title={t`API tokens`}
                subtitle={t`Let another application use this API on your behalf, without sharing your password.`}
            >
                <Field label={t`Token name`}
                       description={t`So you can tell them apart later, e.g. dehorsqc.com website`}/>
                <ButtonSkeleton width={150}/>
            </SettingsCard>
        )}
    </div>
);
