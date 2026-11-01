import {Attendee} from "../../../types.ts";
import {t} from "@lingui/macro";
import {StatusTag, StatusTone} from "../StatusTag";

interface AttendeeStatusBadgeProps {
    attendee: Attendee;
    noStyle?: boolean;
}

const TONES: Record<string, StatusTone> = {
    'ACTIVE': 'ok',
    'AWAITING_PAYMENT': 'waiting',
    'CANCELLED': 'neutral',
};

const TEXT_COLORS: Record<StatusTone, string> = {
    ok: '#2f6b3a',
    waiting: '#7a5200',
    neutral: '#6e625a',
    problem: '#9a3b25',
};

export const AttendeeStatusBadge = ({attendee, noStyle = false}: AttendeeStatusBadgeProps) => {
    const tone = TONES[attendee.status] ?? 'ok';

    const statusLabels: Record<string, string> = {
        'ACTIVE': t`Active`,
        'CANCELLED': t`Cancelled`,
        'AWAITING_PAYMENT': t`Awaiting Payment`,
    };

    const status = statusLabels[attendee.status] || attendee.status.replace('_', ' ');

    if (noStyle) {
        return <span style={{color: TEXT_COLORS[tone], fontWeight: 700}}>{status}</span>;
    }

    return <StatusTag tone={tone}>{status}</StatusTag>;
};
