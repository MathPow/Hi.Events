import {FormEvent, useState} from "react";
import {Button, Checkbox, TextInput} from "@mantine/core";
import {t} from "@lingui/macro";
import {IdParam} from "../../../../types.ts";
import {OrganizerPageSuggestion} from "../../../../api/organizer.client.ts";
import {useImportOrganizerPage} from "../../../../mutations/useImportOrganizerPage.ts";
import {socialPlatformLabel} from "./socialPlatforms.ts";
import classes from "./OrganizerHomepageDesigner.module.scss";

export type ImportPart = 'name' | 'description' | 'accent' | 'logo' | 'cover' | 'social' | 'faqs';

interface ImportFromUrlProps {
    organizerId: IdParam;
    disabled?: boolean;
    onApply: (suggestion: OrganizerPageSuggestion, parts: ImportPart[]) => Promise<void>;
}

const plainText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const errorMessage = (error: any): string =>
    error?.response?.data?.errors?.url?.[0]
    ?? error?.response?.data?.message
    ?? t`The page could not be read. Check the address and try again.`;

// « Remplir depuis votre site ou votre Instagram »: the server reads the page, the assistant writes
// the texts, and what the organizer keeps goes into the draft. Nothing is published here.
export const ImportFromUrl = ({organizerId, disabled, onApply}: ImportFromUrlProps) => {
    const importPage = useImportOrganizerPage(organizerId);
    const [url, setUrl] = useState('');
    const [suggestion, setSuggestion] = useState<OrganizerPageSuggestion | null>(null);
    const [kept, setKept] = useState<ImportPart[]>([]);
    const [applying, setApplying] = useState(false);

    const found = (result: OrganizerPageSuggestion): ImportPart[] => ([
        result.name && 'name',
        result.description && 'description',
        result.accent && 'accent',
        result.logo && 'logo',
        result.cover && 'cover',
        result.social_links.length > 0 && 'social',
        result.faqs.length > 0 && 'faqs',
    ].filter(Boolean) as ImportPart[]);

    const scan = (event: FormEvent) => {
        event.preventDefault();
        if (!url.trim()) {
            return;
        }
        importPage.mutate(url.trim(), {
            onSuccess: (result) => {
                setSuggestion(result);
                setKept(found(result));
            },
        });
    };

    const toggle = (part: ImportPart) =>
        setKept(current => current.includes(part) ? current.filter(item => item !== part) : [...current, part]);

    const apply = async () => {
        if (!suggestion) {
            return;
        }
        setApplying(true);
        try {
            await onApply(suggestion, kept);
            setSuggestion(null);
            setUrl('');
        } finally {
            setApplying(false);
        }
    };

    const rows = suggestion ? found(suggestion).map(part => {
        const labels: Record<ImportPart, string> = {
            name: t`Name`,
            description: t`Introduction`,
            accent: t`Accent color`,
            logo: t`Logo`,
            cover: t`Cover image`,
            social: t`Social networks`,
            faqs: t`FAQ`,
        };
        const faqCount = suggestion.faqs.length;
        const preview = {
            name: <span className={classes.importValue}>{suggestion.name}</span>,
            description: <span className={classes.importValue} data-clamp>{plainText(suggestion.description ?? '')}</span>,
            accent: (
                <span className={classes.importValue}>
                    <span className={classes.importSwatch} style={{background: suggestion.accent ?? undefined}}/>
                    {suggestion.accent}
                </span>
            ),
            logo: <img className={classes.importLogo} src={suggestion.logo ?? undefined} alt=""/>,
            cover: <img className={classes.importCover} src={suggestion.cover ?? undefined} alt=""/>,
            social: (
                <span className={classes.importValue}>
                    {suggestion.social_links.map(link => socialPlatformLabel(link.platform)).join(', ')}
                </span>
            ),
            faqs: <span className={classes.importValue}>{t`${faqCount} questions`}</span>,
        }[part];

        return (
            <label key={part} className={classes.importRow}>
                <Checkbox checked={kept.includes(part)} onChange={() => toggle(part)} color="var(--dehors-brun)"/>
                <span className={classes.importLabel}>{labels[part]}</span>
                {preview}
            </label>
        );
    }) : [];

    return (
        <section className={`${classes.section} ${classes.importCard}`}>
            <div className={classes.importHeader}>
                <span className={classes.pastille}>
                    <img src="/interface/admin/ma-page/globe.svg" alt=""/>
                </span>
                <span className={classes.sectionText}>
                    <span className={classes.sectionTitle}>{t`Fill from your website or Instagram`}</span>
                    <span className={classes.sectionSubtitle}>
                        {t`We suggest a name, a text, a color, images and your networks. You choose what to keep.`}
                    </span>
                </span>
            </div>

            <div className={classes.sectionBody}>
                {!suggestion && (
                    <form className={classes.importForm} onSubmit={scan}>
                        <TextInput
                            className={`${classes.field} ${classes.importInput}`}
                            value={url}
                            onChange={(event) => setUrl(event.currentTarget.value)}
                            placeholder={t`yourclub.com`}
                            aria-label={t`Address of your website or Instagram`}
                            inputMode="url"
                            disabled={disabled || importPage.isPending}
                            error={importPage.isError ? errorMessage(importPage.error) : undefined}
                        />
                        <Button
                            type="submit"
                            className={`${classes.button} ${classes.buttonFilled}`}
                            loading={importPage.isPending}
                            disabled={disabled || !url.trim()}
                        >
                            {t`Analyze`}
                        </Button>
                    </form>
                )}

                {importPage.isPending && (
                    <p className={classes.importNote}>{t`Reading the page… This can take up to 30 seconds.`}</p>
                )}

                {suggestion && (
                    <>
                        {rows.length === 0 ? (
                            <p className={classes.importNote}>{t`Nothing usable was found on this page.`}</p>
                        ) : (
                            <div className={classes.importRows}>{rows}</div>
                        )}

                        {suggestion.limited && (
                            <p className={classes.importNote}>
                                {suggestion.source === 'instagram'
                                    ? t`Without an account, Instagram only shows the profile picture and the bio: complete the text yourself.`
                                    : t`This page shows little text: complete what is missing yourself.`}
                            </p>
                        )}
                        {!suggestion.written_by_assistant && rows.length > 0 && (
                            <p className={classes.importNote}>{t`The texts are taken as is from the page.`}</p>
                        )}

                        <div className={classes.importActions}>
                            <Button
                                className={`${classes.button} ${classes.buttonFilled}`}
                                onClick={apply}
                                loading={applying}
                                disabled={kept.length === 0 || disabled}
                            >
                                {t`Add to my draft`}
                            </Button>
                            <button type="button" className={classes.textButton}
                                    onClick={() => setSuggestion(null)} disabled={applying}>
                                {t`Cancel`}
                            </button>
                        </div>
                        <p className={classes.importNote}>{t`Nothing is published: check the preview, then publish.`}</p>
                    </>
                )}
            </div>
        </section>
    );
};
