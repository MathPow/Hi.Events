import {Checkbox, Text, TextInput} from "@mantine/core";
import {UseFormReturnType} from "@mantine/form";
import {t} from "@lingui/macro";
import {UserGeneratedContent} from "../UserGeneratedContent";
import {WAIVER_ADULT_AGE} from "../../../utilites/dates.ts";
import classes from "./WaiverSignature.module.scss";

interface WaiverSignatureProps {
    waiverText: string;
    form: UseFormReturnType<any>;
    // Where the signature lives in the form: products.N.waiver.
    path: string;
    // Under WAIVER_ADULT_AGE on the event's day: a parent or guardian signs too.
    isMinor: boolean;
}

/**
 * The event's waiver at checkout: its text, scrollable, then the attendee's
 * acceptance and signature, their full name typed in.
 */
export const WaiverSignature = ({waiverText, form, path, isMinor}: WaiverSignatureProps) => (
    <div className={classes.waiver}>
        <Text fw={600} size="sm">{t`Liability waiver`}</Text>
        <UserGeneratedContent className={classes.text} dangerouslySetInnerHTML={{__html: waiverText}}/>
        <Checkbox
            label={t`I have read the waiver and I accept it`}
            {...form.getInputProps(`${path}.accepted`, {type: 'checkbox'})}
        />
        <TextInput
            withAsterisk
            label={t`Signature`}
            description={t`Type your full name to sign.`}
            placeholder={t`Full name`}
            maxLength={100}
            {...form.getInputProps(`${path}.signed_name`)}
        />
        {isMinor && (
            <TextInput
                withAsterisk
                label={t`Parent or guardian`}
                description={t`The participant is under ${WAIVER_ADULT_AGE}: a parent or guardian signs with their full name.`}
                placeholder={t`Full name of the parent or guardian`}
                maxLength={100}
                {...form.getInputProps(`${path}.guardian_name`)}
            />
        )}
    </div>
);
