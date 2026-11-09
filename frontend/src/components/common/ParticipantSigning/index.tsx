import {useState} from "react";
import {Button} from "@mantine/core";
import {useForm} from "@mantine/form";
import {t} from "@lingui/macro";
import {AxiosError} from "axios";
import {
    ParticipantSignatureInput,
    PendingDocumentCopy,
    PendingSignatures,
} from "../../../api/participantSignature.client.ts";
import {PublicOrganizerDocument} from "../../../api/organizerDocument.client.ts";
import {WaiverSignature} from "../WaiverSignature";
import {DocumentSignatureEntry, DocumentSigning, emptyDocumentEntry} from "../DocumentSigning";
import {showError} from "../../../utilites/notifications.tsx";
import classes from "./ParticipantSigning.module.scss";

interface ParticipantSigningProps {
    pending: PendingSignatures;
    onSign: (input: ParticipantSignatureInput) => Promise<void>;
    // Le bouton: « Signer » sur le billet, « Signer et faire entrer » a la porte.
    submitLabel: string;
}

interface SigningValues {
    waiver: { accepted: boolean, signed_name: string, guardian_name: string };
    sign: { documents: DocumentSignatureEntry[] };
}

// Une copie lue comme le document qu'elle reprend, pour les composants de la caisse.
const asDocument = (copy: PendingDocumentCopy): PublicOrganizerDocument => ({
    id: copy.id,
    title: copy.title,
    blocks: copy.blocks,
    audience: copy.audience,
    signing_mode: 'ONLINE',
    audience_age: null,
});

/**
 * Ce qu'un participant signe lui-meme apres l'achat (la decharge, les
 * documents en ligne), avec les memes champs qu'a la caisse: depuis le lien de
 * son billet, ou a l'entree sur l'appareil du benevole.
 */
export const ParticipantSigning = ({pending, onSign, submitLabel}: ParticipantSigningProps) => {
    const [submitting, setSubmitting] = useState(false);
    const documents = pending.documents.map(asDocument);
    const isMinor = pending.documents[0]?.is_minor ?? pending.waiver_is_minor;
    const form = useForm<SigningValues>({
        initialValues: {
            waiver: {accepted: false, signed_name: '', guardian_name: ''},
            sign: {documents: documents.map(emptyDocumentEntry)},
        },
    });

    const submit = async (values: SigningValues) => {
        setSubmitting(true);
        try {
            await onSign({
                ...(pending.waiver_text ? {waiver: values.waiver} : {}),
                documents: Object.fromEntries(pending.documents.map((copy, position) => [
                    copy.id,
                    {accepted: values.sign.documents[position]?.accepted ?? false, answers: values.sign.documents[position]?.answers ?? {}},
                ])),
            });
        } catch (error) {
            const errors = (error as AxiosError<{ errors?: Record<string, string[]> }>)?.response?.data?.errors;
            if (!errors) {
                showError(t`The signature could not be saved. Check your connection and try again.`);
                return;
            }
            // documents.<copie>.… -> sign.documents.<position>.… , la ou les champs le lisent.
            form.setErrors(Object.fromEntries(Object.entries(errors).map(([key, messages]) => {
                const match = key.match(/^documents\.(\d+)\.(.+)$/);
                const position = match ? pending.documents.findIndex(copy => copy.id === Number(match[1])) : -1;
                return [position >= 0 ? `sign.documents.${position}.${match![2]}` : key, messages[0]];
            })));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className={classes.signing} onSubmit={form.onSubmit(submit)} noValidate>
            {pending.waiver_text && (
                <WaiverSignature
                    waiverText={pending.waiver_text}
                    form={form}
                    path="waiver"
                    isMinor={pending.waiver_is_minor}
                />
            )}
            {documents.length > 0 && (
                <DocumentSigning
                    documents={documents}
                    form={form}
                    path="sign"
                    isMinor={isMinor}
                    isUnder={() => true}
                    askBirthDate={false}
                    autoValues={pending.documents[0]?.auto_values ?? {}}
                />
            )}
            <Button type="submit" loading={submitting} className={classes.submit}>
                {submitLabel}
            </Button>
        </form>
    );
};
