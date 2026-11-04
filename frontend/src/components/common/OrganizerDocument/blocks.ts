import {WAIVER_ADULT_AGE} from "../../../utilites/dates.ts";
import {t} from "@lingui/macro";
import {JSONContent} from "@tiptap/core";
import {
    DocumentAudience,
    DocumentAutoField,
    DocumentBlock,
    DocumentBlockType,
    DocumentTemplateKey,
} from "../../../api/organizerDocument.client.ts";

export const blockTypeLabel = (type: DocumentBlockType): string => ({
    title: t`Title`,
    paragraph: t`Paragraph`,
    clause: t`Numbered clause`,
    list: t`Bulleted list`,
    field: t`Field to fill in`,
    checkbox: t`Checkbox`,
    signature: t`Signature`,
    separator: t`Separator`,
})[type];

export const autoFieldLabel = (key: DocumentAutoField | string): string => ({
    participant_name: t`Participant name`,
    date_of_birth: t`Date of birth`,
    event_name: t`Event name`,
    event_date: t`Event date`,
    organizer_name: t`Organizer`,
} as Record<string, string>)[key] ?? key;

export const templateLabel = (key: DocumentTemplateKey): string => ({
    parental_consent: t`Parental consent (minor)`,
    liability_waiver: t`Liability waiver`,
    medical_form: t`Medical form`,
    photo_consent: t`Photo and video consent`,
    blank: t`Blank document`,
})[key];

export const newBlockId = (): string => 'b' + Math.random().toString(36).slice(2, 12);

export const emptyRichText = (list = false): JSONContent => list
    ? {type: 'doc', content: [{type: 'bulletList', content: [{type: 'listItem', content: [{type: 'paragraph'}]}]}]}
    : {type: 'doc', content: [{type: 'paragraph'}]};

export const newBlock = (type: DocumentBlockType): DocumentBlock => {
    const id = newBlockId();

    switch (type) {
        case 'title':
        case 'paragraph':
        case 'clause':
            return {id, type, content: emptyRichText()};
        case 'list':
            return {id, type, content: emptyRichText(true)};
        case 'checkbox':
            return {id, type, content: emptyRichText(), required: false};
        case 'field':
            return {id, type, label: '', required: false};
        case 'signature':
            return {id, type, signer: 'participant'};
        default:
            return {id, type};
    }
};

// Les memes regles que DocumentBlocks et DocumentSigningService cote serveur.
const signatures = (blocks: DocumentBlock[], signer: 'participant' | 'guardian') =>
    blocks.filter(block => block.type === 'signature' && (block.signer ?? 'participant') === signer);

const usesAutoField = (node: JSONContent | undefined, key: string): boolean =>
    !!node && ((node.type === 'field' && node.attrs?.key === key) || !!node.content?.some(child => usesAutoField(child, key)));

export const documentNeedsBirthDate = (blocks: DocumentBlock[], audience: DocumentAudience): boolean =>
    audience === 'MINORS'
    || signatures(blocks, 'guardian').length > 0
    || blocks.some(block => usesAutoField(block.content, 'date_of_birth'));

export const guardianSigns = (audience: DocumentAudience, isMinor: boolean): boolean =>
    audience === 'MINORS' || isMinor;

export const needsImplicitSignature = (blocks: DocumentBlock[], guardianSigning: boolean): boolean =>
    signatures(blocks, 'participant').length === 0
    && !(guardianSigning && signatures(blocks, 'guardian').length > 0);

// « Selon l'âge »: under its age limit on the event's day (18 when it has none). Null: for everyone.
export const documentAgeLimit = (document: { audience: DocumentAudience, audience_age?: number | null }): number | null =>
    document.audience === 'MINORS' ? (document.audience_age ?? WAIVER_ADULT_AGE) : null;

export const documentApplies = (
    document: { audience: DocumentAudience, audience_age?: number | null },
    isUnder: (age: number) => boolean,
): boolean => {
    const ageLimit = documentAgeLimit(document);

    return ageLimit === null || isUnder(ageLimit);
};
