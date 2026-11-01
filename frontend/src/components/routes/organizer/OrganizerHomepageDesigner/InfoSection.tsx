import {t} from "@lingui/macro";
import {TextInput} from "@mantine/core";
import {Editor} from "../../../common/Editor";
import classes from "./OrganizerHomepageDesigner.module.scss";

interface InfoSectionProps {
    name: string;
    description: string;
    // Changes when the draft is discarded or published: the editor only follows a non-empty value.
    editorKey: number;
    onChange: (values: { name?: string, description?: string }) => void;
    disabled?: boolean;
}

// Same data as Settings → Basic Information (name, description).
export const InfoSection = ({name, description, editorKey, onChange, disabled}: InfoSectionProps) => (
    <>
        <TextInput
            className={classes.field}
            label={t`Display name`}
            value={name}
            maxLength={100}
            required
            withAsterisk={false}
            disabled={disabled}
            error={name.trim() === '' ? t`Name is required` : undefined}
            onChange={(event) => onChange({name: event.currentTarget.value})}
        />
        <Editor
            key={editorKey}
            className={classes.description}
            label={t`Description`}
            value={description}
            editorType={'simple'}
            maxLength={1000}
            onChange={(value) => onChange({description: value})}
        />
    </>
);
