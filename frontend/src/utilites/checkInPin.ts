import {IdParam} from "../types.ts";
import {isSsr} from "./helpers.ts";

export const CHECK_IN_PIN_HEADER = 'X-Check-In-Pin';

export const CHECK_IN_PIN_REQUIRED_CODE = 'CHECK_IN_PIN_REQUIRED';

export const CHECK_IN_PIN_INVALID_CODE = 'CHECK_IN_PIN_INVALID';

const storageKey = (checkInListShortId: IdParam) => `checkInPin:${checkInListShortId}`;

/**
 * The door code is remembered per check-in list on the device holding it, so a volunteer types it
 * once a shift rather than once a scan.
 */
export const getCheckInPin = (checkInListShortId: IdParam): string | null => {
    if (isSsr()) {
        return null;
    }

    try {
        return localStorage.getItem(storageKey(checkInListShortId));
    } catch {
        return null;
    }
};

export const setCheckInPin = (checkInListShortId: IdParam, pin: string): void => {
    if (isSsr()) {
        return;
    }

    try {
        localStorage.setItem(storageKey(checkInListShortId), pin);
    } catch {
        // A device with storage blocked simply asks for the PIN again.
    }
};

export const clearCheckInPin = (checkInListShortId: IdParam): void => {
    if (isSsr()) {
        return;
    }

    try {
        localStorage.removeItem(storageKey(checkInListShortId));
    } catch {
        // Nothing to do - the stored value is best effort.
    }
};

export const checkInPinHeaders = (checkInListShortId: IdParam): Record<string, string> => {
    const pin = getCheckInPin(checkInListShortId);

    return pin ? {[CHECK_IN_PIN_HEADER]: pin} : {};
};
