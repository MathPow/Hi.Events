import {intlLocale} from "../../../utilites/intlLocale.ts";

/** « 5,2 km », « 800 m » in the page's language. */
export const formatKm = (metres: number): string => {
    const locale = intlLocale();
    if (metres < 1000) {
        return new Intl.NumberFormat(locale, {style: 'unit', unit: 'meter', maximumFractionDigits: 0}).format(Math.round(metres / 10) * 10);
    }

    return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'kilometer',
        maximumFractionDigits: metres < 100000 ? 1 : 0,
    }).format(metres / 1000);
};

/** « 45 m » of climb. */
export const formatClimb = (metres: number): string =>
    new Intl.NumberFormat(intlLocale(), {style: 'unit', unit: 'meter', maximumFractionDigits: 0}).format(Math.round(metres));

/** « +0,3 km » / « −0,2 km »: how far the course is from the distance asked for. */
export const formatGap = (metres: number): string => {
    const sign = metres >= 0 ? '+' : '−';

    return `${sign}${new Intl.NumberFormat(intlLocale(), {maximumFractionDigits: 1, minimumFractionDigits: 1}).format(Math.abs(metres) / 1000)} km`;
};
