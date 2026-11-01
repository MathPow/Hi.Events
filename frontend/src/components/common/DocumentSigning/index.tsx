import {Checkbox, Text, TextInput} from "@mantine/core";
import {UseFormReturnType} from "@mantine/form";
import {t} from "@lingui/macro";
import {
    DocumentBlock,
    IMPLICIT_SIGNATURE,
    PublicOrganizerDocument,
} from "../../../api/organizerDocument.client.ts";
import {
    documentApplies,
    guardianSigns,
    needsImplicitSignature,
} from "../OrganizerDocument/blocks.ts";
import {DocumentContent, RichInline} from "../OrganizerDocument/DocumentContent.tsx";
import classes from "./DocumentSigning.module.scss";

export interface DocumentSignatureEntry {
    document_id: number;
    accepted: boolean;
    answers: Record<string, string | boolean>;
}

export const emptyDocumentEntry = (document: PublicOrganizerDocument): DocumentSignatureEntry => ({
    document_id: document.id,
    accepted: false,
    answers: {},
});

interface DocumentSigningProps {
    // Tous les documents lies a l'evenement; les entrees du formulaire suivent ceux a signer en ligne.
    documents: PublicOrganizerDocument[];
    form: UseFormReturnType<any>;
    // La fiche du participant dans le formulaire: products.N.
    path: string;
    isMinor: boolean;
    // Sans question « date de naissance » au formulaire, les documents la demandent eux-memes.
    askBirthDate: boolean;
    // Les champs automatiques connus a la caisse (nom du participant, evenement...).
    autoValues: Partial<Record<string, string>>;
}

/**
 * Les documents de l'organisateur a la caisse, pour un participant: chacun a
 * lire, ses champs a remplir et sa signature (le nom complet tape); un parent
 * ou tuteur signe aussi pour un mineur. Les documents a imprimer sont annonces.
 */
export const DocumentSigning = ({documents, form, path, isMinor, askBirthDate, autoValues}: DocumentSigningProps) => {
    const online = documents.filter(document => document.signing_mode === 'ONLINE');
    const toPrint = documents.filter(document => document.signing_mode === 'PRINT' && documentApplies(document.audience, isMinor));
    const generalError = form.errors[`${path}.documents`];

    if (!documents.length) {
        return null;
    }

    return (
        <div className={classes.documents}>
            {askBirthDate && (
                <TextInput
                    type="date"
                    withAsterisk
                    label={t`Participant's date of birth`}
                    description={t`The organizer's documents depend on it (a parent signs for a minor).`}
                    max={new Date().toISOString().slice(0, 10)}
                    {...form.getInputProps(`${path}.document_birth_date`)}
                />
            )}

            {generalError && <Text c="red" size="sm">{generalError}</Text>}

            {online.map((document, position) => {
                if (!documentApplies(document.audience, isMinor)) {
                    return null;
                }

                const entryPath = `${path}.documents.${position}`;
                const guardianSigning = guardianSigns(document.audience, isMinor);

                const input = (block: DocumentBlock) => {
                    const answerPath = `${entryPath}.answers.${block.id}`;

                    if (block.type === 'field') {
                        return (
                            <TextInput
                                label={block.label || t`Answer`}
                                withAsterisk={!!block.required}
                                maxLength={1000}
                                {...form.getInputProps(answerPath)}
                                value={(form.getInputProps(answerPath).value as string | undefined) ?? ''}
                            />
                        );
                    }
                    if (block.type === 'checkbox') {
                        return (
                            <Checkbox
                                label={<RichInline content={block.content} autoValues={autoValues}/>}
                                {...form.getInputProps(answerPath, {type: 'checkbox'})}
                                checked={!!form.getInputProps(answerPath, {type: 'checkbox'}).checked}
                            />
                        );
                    }
                    if (block.type === 'signature') {
                        if (block.signer === 'guardian' && !guardianSigning) {
                            return null;
                        }
                        return (
                            <SignatureInput
                                form={form}
                                path={answerPath}
                                guardian={block.signer === 'guardian'}
                            />
                        );
                    }

                    return undefined;
                };

                return (
                    <section key={document.id} className={classes.document} data-rough>
                        {/* Le titre du document, sauf s'il commence deja par le sien. */}
                        {document.blocks[0]?.type !== 'title' && (
                            <Text fw={700} className={classes.title}>{document.title}</Text>
                        )}
                        <DocumentContent blocks={document.blocks} autoValues={autoValues} renderInput={input}/>
                        {needsImplicitSignature(document.blocks, guardianSigning) && (
                            <SignatureInput form={form} path={`${entryPath}.answers.${IMPLICIT_SIGNATURE}`} guardian={false}/>
                        )}
                        <Checkbox
                            className={classes.accept}
                            label={t`I have read this document and I accept it`}
                            {...form.getInputProps(`${entryPath}.accepted`, {type: 'checkbox'})}
                            checked={!!form.getInputProps(`${entryPath}.accepted`, {type: 'checkbox'}).checked}
                        />
                    </section>
                );
            })}

            {toPrint.length > 0 && (
                <p className={classes.printNote}>
                    {t`To print and bring signed, sent with the ticket:`} {toPrint.map(document => document.title).join(', ')}
                </p>
            )}
        </div>
    );
};

const SignatureInput = ({form, path, guardian}: { form: UseFormReturnType<any>, path: string, guardian: boolean }) => (
    <TextInput
        withAsterisk
        label={guardian ? t`Signature of a parent or guardian` : t`Signature`}
        description={guardian ? t`The participant is a minor: a parent or guardian types their full name.` : t`Type your full name to sign.`}
        placeholder={guardian ? t`Full name of the parent or guardian` : t`Full name`}
        maxLength={100}
        {...form.getInputProps(path)}
        value={(form.getInputProps(path).value as string | undefined) ?? ''}
    />
);
