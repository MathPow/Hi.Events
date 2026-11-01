// Anthropic bills in US dollars; a call often costs a few cents, so small amounts keep more digits.
export const formatUsd = (amount: number) => new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(amount) > 0 && Math.abs(amount) < 1 ? 4 : 2,
}).format(amount);

export const formatCompact = (count: number) => new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
}).format(count);
