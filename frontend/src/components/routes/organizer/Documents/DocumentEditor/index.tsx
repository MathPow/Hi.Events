import {t, Trans} from "@lingui/macro";
import {MouseEvent as ReactMouseEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link, useParams} from "react-router";
import {Editor} from "@tiptap/core";
import {ActionIcon, Button, Drawer, Menu, Popover, Skeleton, Switch, UnstyledButton} from "@mantine/core";
import dayjs from "dayjs";
import {
    IconAlertTriangle,
    IconArrowDown,
    IconArrowUp,
    IconBold,
    IconCheck,
    IconChevronDown,
    IconChevronLeft,
    IconCopy,
    IconDownload,
    IconEye,
    IconGripVertical,
    IconItalic,
    IconList,
    IconListNumbers,
    IconPencil,
    IconPlus,
    IconSeparatorHorizontal,
    IconSettings,
    IconSignature,
    IconSquareCheck,
    IconAlignLeft,
    IconTypography,
    IconTrash,
    IconForms,
    IconVariable,
} from "@tabler/icons-react";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {PageBody} from "../../../../common/PageBody";
import {useGetOrganizer} from "../../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerDocument} from "../../../../../queries/useGetOrganizerDocuments.ts";
import {useGetOrganizerEvents} from "../../../../../queries/useGetOrganizerEvents.ts";
import {
    DOCUMENT_AUTO_FIELDS,
    DocumentBlock,
    DocumentBlockType,
    organizerDocumentClient,
    OrganizerDocument,
} from "../../../../../api/organizerDocument.client.ts";
import {autoFieldLabel, blockTypeLabel, newBlock, newBlockId} from "../../../../common/OrganizerDocument/blocks.ts";
import {relativeDate} from "../../../../../utilites/dates.ts";
import {showError} from "../../../../../utilites/notifications.tsx";
import {exportDocumentPdf} from "../exportDocumentPdf.ts";
import {RichBlockEditor, RichBlockKind} from "./RichBlockEditor.tsx";
import {DocumentDraft, SaveStatus, useDocumentAutosave} from "./useDocumentAutosave.ts";
import classes from "./DocumentEditor.module.scss";

const BLOCK_TYPES: { type: DocumentBlockType, icon: ReactNode }[] = [
    {type: 'title', icon: <IconTypography size={18}/>},
    {type: 'paragraph', icon: <IconAlignLeft size={18}/>},
    {type: 'clause', icon: <IconListNumbers size={18}/>},
    {type: 'list', icon: <IconList size={18}/>},
    {type: 'field', icon: <IconForms size={18}/>},
    {type: 'checkbox', icon: <IconSquareCheck size={18}/>},
    {type: 'signature', icon: <IconSignature size={18}/>},
    {type: 'separator', icon: <IconSeparatorHorizontal size={18}/>},
];

const RICH_KIND: Partial<Record<DocumentBlockType, RichBlockKind>> = {
    title: 'single',
    paragraph: 'multi',
    clause: 'single',
    list: 'list',
    checkbox: 'single',
};

const toDraft = (document: OrganizerDocument): DocumentDraft => ({
    title: document.title,
    blocks: document.blocks,
    signing_mode: document.signing_mode,
    audience: document.audience,
    event_ids: document.event_ids,
});

/**
 * L'editeur d'un document: les blocs a gauche, la feuille au centre (un bloc
 * choisi a sa barre d'outils), les reglages a droite. Tout s'enregistre seul.
 */
const DocumentEditor = () => {
    const {organizerId, documentId} = useParams();
    const documentQuery = useGetOrganizerDocument(organizerId, documentId);
    const {data: organizer} = useGetOrganizer(organizerId);
    const [draft, setDraft] = useState<DocumentDraft | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const editors = useRef(new Map<string, Editor>());
    const pendingFocus = useRef<string | null>(null);
    const autosave = useDocumentAutosave(organizerId, documentId, draft);

    useEffect(() => {
        if (documentQuery.data && !draft) {
            setDraft(toDraft(documentQuery.data));
        }
    }, [documentQuery.data, draft]);

    const registerEditor = useCallback((blockId: string, editor: Editor | null) => {
        if (!editor) {
            editors.current.delete(blockId);
            return;
        }
        editors.current.set(blockId, editor);
        if (pendingFocus.current === blockId) {
            pendingFocus.current = null;
            editor.commands.focus('end');
        }
    }, []);

    const blocks = draft?.blocks ?? [];

    const setBlocks = (change: (blocks: DocumentBlock[]) => DocumentBlock[]) =>
        setDraft(current => current ? {...current, blocks: change(current.blocks)} : current);

    const updateBlock = (blockId: string, patch: Partial<DocumentBlock>) =>
        setBlocks(current => current.map(block => block.id === blockId ? {...block, ...patch} : block));

    const insertBlock = (block: DocumentBlock, afterId: string | null = selectedId) => {
        setBlocks(current => {
            const index = afterId ? current.findIndex(candidate => candidate.id === afterId) : -1;
            const at = index === -1 ? current.length : index + 1;
            return [...current.slice(0, at), block, ...current.slice(at)];
        });
        setSelectedId(block.id);
        pendingFocus.current = block.id;
        requestAnimationFrame(() => document.getElementById(`block-${block.id}`)?.scrollIntoView({block: 'nearest', behavior: 'smooth'}));
    };

    const addBlock = (type: DocumentBlockType) => insertBlock(newBlock(type));

    const moveBlock = (blockId: string, offset: number) => setBlocks(current => {
        const index = current.findIndex(block => block.id === blockId);
        const target = index + offset;
        return index === -1 || target < 0 || target >= current.length ? current : arrayMove(current, index, target);
    });

    const duplicateBlock = (blockId: string) => {
        const block = blocks.find(candidate => candidate.id === blockId);
        if (block) {
            insertBlock({...structuredClone(block), id: newBlockId()}, blockId);
        }
    };

    const removeBlock = (blockId: string) => {
        const index = blocks.findIndex(block => block.id === blockId);
        const previous = blocks[index - 1] ?? blocks[index + 1] ?? null;
        setBlocks(current => current.filter(block => block.id !== blockId));
        setSelectedId(previous?.id ?? null);
        if (previous) {
            editors.current.get(previous.id)?.commands.focus('end');
        }
    };

    // Un champ automatique: dans le texte du bloc choisi, sinon dans un nouveau paragraphe.
    const insertAutoField = (key: string) => {
        const editor = selectedId ? editors.current.get(selectedId) : undefined;
        if (editor) {
            editor.chain().focus().insertContent([{type: 'field', attrs: {key}}, {type: 'text', text: ' '}]).run();
            return;
        }
        insertBlock({
            ...newBlock('paragraph'),
            content: {type: 'doc', content: [{type: 'paragraph', content: [{type: 'field', attrs: {key}}, {type: 'text', text: ' '}]}]},
        });
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
    );

    const onDragEnd = ({active, over}: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }
        setBlocks(current => arrayMove(
            current,
            current.findIndex(block => block.id === active.id),
            current.findIndex(block => block.id === over.id),
        ));
    };

    const openPdfPreview = async () => {
        const preview = window.open('', '_blank');
        try {
            await autosave.save();
            const pdf = await organizerDocumentClient.pdf(organizerId, documentId);
            const url = URL.createObjectURL(pdf);
            if (preview) {
                preview.location.href = url;
            } else {
                window.location.href = url;
            }
        } catch {
            preview?.close();
            showError(t`The PDF could not be created. Please try again.`);
        }
    };

    const exportPdf = async () => {
        if (!draft) {
            return;
        }
        await autosave.save();
        await exportDocumentPdf(organizerId, {id: Number(documentId), title: draft.title});
    };

    if (documentQuery.isError) {
        return (
            <PageBody>
                <p className={classes.notFound}>{t`This document could not be found.`}</p>
                <Button component={Link} to={`/manage/organizer/${organizerId}/documents`} variant="outline">
                    {t`Back to documents`}
                </Button>
            </PageBody>
        );
    }

    if (!draft) {
        return (
            <PageBody>
                <Skeleton height={48} width="50%" radius="md" mb="lg"/>
                <div className={classes.layout}>
                    <Skeleton height={480} radius={24}/>
                    <Skeleton height={640} radius={24}/>
                    <Skeleton height={480} radius={24}/>
                </div>
            </PageBody>
        );
    }

    let clauseNumber = 0;
    const settings = (
        <DocumentSettings
            draft={draft}
            onChange={(changes) => setDraft(current => current ? {...current, ...changes} : current)}
            onExport={exportPdf}
        />
    );

    return (
        <PageBody>
            <div className={classes.header}>
                <ActionIcon
                    component={Link}
                    to={`/manage/organizer/${organizerId}/documents`}
                    variant="outline"
                    size={44}
                    radius="md"
                    className={classes.back}
                    aria-label={t`Back to documents`}
                >
                    <IconChevronLeft size={20}/>
                </ActionIcon>
                <div className={classes.titleArea}>
                    <DocumentTitle
                        title={draft.title}
                        onChange={(title) => setDraft(current => current ? {...current, title} : current)}
                    />
                    <SaveIndicator status={autosave.status} savedAt={autosave.savedAt} onRetry={autosave.save}/>
                </div>
                <Button
                    variant="outline"
                    leftSection={<IconEye size={18}/>}
                    className={classes.previewButton}
                    onClick={openPdfPreview}
                >
                    {t`PDF preview`}
                </Button>
            </div>

            <div className={classes.layout}>
                <aside className={`${classes.panel} ${classes.palette}`}>
                    <p className={classes.panelLabel}>{t`Add a block`}</p>
                    <div className={classes.blockTypes}>
                        {BLOCK_TYPES.map(({type, icon}) => (
                            <button key={type} type="button" className={classes.blockType} onClick={() => addBlock(type)}>
                                <span className={classes.blockTypeIcon}>{icon}</span>
                                <span className={classes.blockTypeName}>{blockTypeLabel(type)}</span>
                                <IconPlus size={16} className={classes.blockTypePlus}/>
                            </button>
                        ))}
                    </div>
                    <hr className={classes.panelRule}/>
                    <p className={classes.panelLabel}>{t`Automatic fields`}</p>
                    <p className={classes.panelHint}>{t`Filled in on their own at registration.`}</p>
                    <div className={classes.chips}>
                        {DOCUMENT_AUTO_FIELDS.map(key => (
                            <button
                                key={key}
                                type="button"
                                className={classes.chip}
                                // La selection du texte reste ou elle est.
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => insertAutoField(key)}
                            >
                                {autoFieldLabel(key)}
                            </button>
                        ))}
                    </div>
                </aside>

                <div className={classes.desk}>
                    <div className={classes.paper} onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedId(null);
                        }
                    }}>
                        <div className={classes.paperHeader}>
                            <span className={classes.paperInitial}>{(organizer?.name ?? '?').slice(0, 1).toUpperCase()}</span>
                            <span className={classes.paperOrganizer}>{organizer?.name}</span>
                        </div>

                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                            <SortableContext items={blocks.map(block => block.id)} strategy={verticalListSortingStrategy}>
                                {blocks.map((block, index) => {
                                    if (block.type === 'clause') {
                                        clauseNumber++;
                                    }
                                    return (
                                        <SortableBlock
                                            key={block.id}
                                            block={block}
                                            clauseNumber={clauseNumber}
                                            selected={selectedId === block.id}
                                            isFirst={index === 0}
                                            isLast={index === blocks.length - 1}
                                            onSelect={() => setSelectedId(block.id)}
                                            onUpdate={(patch) => updateBlock(block.id, patch)}
                                            onMove={(offset) => moveBlock(block.id, offset)}
                                            onDuplicate={() => duplicateBlock(block.id)}
                                            onRemove={() => removeBlock(block.id)}
                                            onEnter={() => insertBlock(newBlock(block.type === 'title' ? 'paragraph' : block.type), block.id)}
                                            editor={() => editors.current.get(block.id)}
                                            registerEditor={registerEditor}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>

                        {blocks.length === 0 && (
                            <p className={classes.emptyPaper}>{t`Add a first block from the list or with the button below.`}</p>
                        )}
                    </div>

                    <AddBlockMenu onAdd={addBlock}>
                        <button type="button" className={classes.addBlock}>
                            <IconPlus size={16}/> {t`Add a block`}
                        </button>
                    </AddBlockMenu>
                </div>

                <aside className={`${classes.panel} ${classes.settings}`}>
                    {settings}
                </aside>
            </div>

            {/* Telephone: les outils restent en bas de l'ecran. */}
            <div className={classes.mobileBar} data-document-editor>
                <AddBlockMenu onAdd={addBlock}>
                    <Button variant="filled" leftSection={<IconPlus size={16}/>}>{t`Block`}</Button>
                </AddBlockMenu>
                <Menu position="top" withinPortal>
                    <Menu.Target>
                        <Button variant="outline" leftSection={<IconVariable size={16}/>}>{t`Field`}</Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {DOCUMENT_AUTO_FIELDS.map(key => (
                            <Menu.Item key={key} onClick={() => insertAutoField(key)}>{autoFieldLabel(key)}</Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu>
                <Button variant="outline" leftSection={<IconSettings size={16}/>} onClick={() => setSettingsOpen(true)}>
                    {t`Settings`}
                </Button>
            </div>
            <Drawer
                opened={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                position="bottom"
                size="auto"
                title={t`Settings`}
            >
                {settings}
            </Drawer>
        </PageBody>
    );
};

const AddBlockMenu = ({onAdd, children}: { onAdd: (type: DocumentBlockType) => void, children: ReactNode }) => (
    <Menu position="top" withinPortal>
        <Menu.Target>{children}</Menu.Target>
        <Menu.Dropdown>
            {BLOCK_TYPES.map(({type, icon}) => (
                <Menu.Item key={type} leftSection={icon} onClick={() => onAdd(type)}>{blockTypeLabel(type)}</Menu.Item>
            ))}
        </Menu.Dropdown>
    </Menu>
);

const DocumentTitle = ({title, onChange}: { title: string, onChange: (title: string) => void }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(title);

    const done = () => {
        setEditing(false);
        const trimmed = value.trim();
        if (trimmed && trimmed !== title) {
            onChange(trimmed);
        } else {
            setValue(title);
        }
    };

    if (editing) {
        return (
            <input
                className={classes.titleInput}
                value={value}
                maxLength={150}
                autoFocus
                aria-label={t`Document name`}
                onChange={(event) => setValue(event.target.value)}
                onBlur={done}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        done();
                    }
                    if (event.key === 'Escape') {
                        setValue(title);
                        setEditing(false);
                    }
                }}
            />
        );
    }

    return (
        <button type="button" className={classes.title} onClick={() => {
            setValue(title);
            setEditing(true);
        }}>
            <span>{title}</span>
            <IconPencil size={18} className={classes.titlePencil}/>
        </button>
    );
};

const SaveIndicator = ({status, savedAt, onRetry}: { status: SaveStatus, savedAt: string | null, onRetry: () => void }) => {
    // « il y a quelques secondes » suit l'heure.
    const [, tick] = useState(0);
    useEffect(() => {
        const interval = window.setInterval(() => tick(value => value + 1), 30_000);
        return () => window.clearInterval(interval);
    }, []);

    if (status === 'error') {
        return (
            <button type="button" className={classes.saveError} onClick={onRetry}>
                <IconAlertTriangle size={14}/> {t`Not saved · Retry`}
            </button>
        );
    }

    if (status === 'saving') {
        return <span className={classes.saveStatus}>{t`Saving…`}</span>;
    }

    const when = savedAt ? relativeDate(savedAt) : null;

    return (
        <span className={classes.saveStatus}>
            <IconCheck size={14} className={classes.saveCheck}/>
            {when ? t`Saved ${when}` : t`All changes saved`}
        </span>
    );
};

interface SortableBlockProps {
    block: DocumentBlock;
    clauseNumber: number;
    selected: boolean;
    isFirst: boolean;
    isLast: boolean;
    onSelect: () => void;
    onUpdate: (patch: Partial<DocumentBlock>) => void;
    onMove: (offset: number) => void;
    onDuplicate: () => void;
    onRemove: () => void;
    onEnter: () => void;
    editor: () => Editor | undefined;
    registerEditor: (blockId: string, editor: Editor | null) => void;
}

const SortableBlock = ({
                           block,
                           clauseNumber,
                           selected,
                           isFirst,
                           isLast,
                           onSelect,
                           onUpdate,
                           onMove,
                           onDuplicate,
                           onRemove,
                           onEnter,
                           editor,
                           registerEditor,
                       }: SortableBlockProps) => {
    const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({id: block.id});
    const kind = RICH_KIND[block.type];

    const richText = (placeholder: string, className?: string) => kind && (
        <RichBlockEditor
            blockId={block.id}
            kind={kind}
            content={block.content}
            placeholder={placeholder}
            className={className}
            registerEditor={registerEditor}
            onChange={(content) => onUpdate({content})}
            onFocus={onSelect}
            onEnter={onEnter}
            onBackspaceEmpty={kind !== 'list' ? onRemove : undefined}
        />
    );

    // Gras et italique sans perdre la selection du texte.
    const keepSelection = (event: ReactMouseEvent) => event.preventDefault();

    return (
        <div
            ref={setNodeRef}
            id={`block-${block.id}`}
            className={classes.block}
            data-type={block.type}
            data-selected={selected || undefined}
            data-dragging={isDragging || undefined}
            style={{transform: CSS.Transform.toString(transform), transition}}
            onMouseDown={onSelect}
            onFocusCapture={onSelect}
        >
            {selected && (
                <div className={classes.toolbar} role="toolbar" aria-label={t`Block tools`}>
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        className={classes.tool}
                        aria-label={t`Move`}
                        {...attributes}
                        {...listeners}
                    >
                        <IconGripVertical size={16}/>
                    </button>
                    {kind && (
                        <>
                            <button type="button" className={classes.tool} aria-label={t`Bold`} onMouseDown={keepSelection}
                                    onClick={() => editor()?.chain().focus().toggleBold().run()}>
                                <IconBold size={16}/>
                            </button>
                            <button type="button" className={classes.tool} aria-label={t`Italic`} onMouseDown={keepSelection}
                                    onClick={() => editor()?.chain().focus().toggleItalic().run()}>
                                <IconItalic size={16}/>
                            </button>
                        </>
                    )}
                    <button type="button" className={classes.tool} aria-label={t`Move up`} disabled={isFirst} onClick={() => onMove(-1)}>
                        <IconArrowUp size={16}/>
                    </button>
                    <button type="button" className={classes.tool} aria-label={t`Move down`} disabled={isLast} onClick={() => onMove(1)}>
                        <IconArrowDown size={16}/>
                    </button>
                    <button type="button" className={classes.tool} aria-label={t`Duplicate`} onClick={onDuplicate}>
                        <IconCopy size={16}/>
                    </button>
                    <button type="button" className={classes.tool} aria-label={t`Delete`} onClick={onRemove}>
                        <IconTrash size={16}/>
                    </button>
                </div>
            )}

            {block.type === 'title' && richText(t`Document title`, classes.titleBlock)}
            {block.type === 'paragraph' && richText(t`Write a paragraph…`, classes.textBlock)}
            {block.type === 'list' && richText(t`List item`, classes.textBlock)}
            {block.type === 'clause' && (
                <div className={classes.clause}>
                    <span className={classes.clauseNumber}>{clauseNumber}.</span>
                    {richText(t`Write a clause…`, classes.textBlock)}
                </div>
            )}
            {block.type === 'checkbox' && (
                <div className={classes.checkbox}>
                    <span className={classes.checkboxBox} aria-hidden/>
                    {richText(t`Text next to the checkbox`, classes.textBlock)}
                </div>
            )}
            {block.type === 'field' && (
                <div className={classes.field}>
                    <input
                        className={classes.fieldLabel}
                        value={block.label ?? ''}
                        maxLength={150}
                        placeholder={t`Field name (e.g. Allergies)`}
                        onChange={(event) => onUpdate({label: event.target.value})}
                    />
                    <span className={classes.fieldLine}/>
                </div>
            )}
            {block.type === 'signature' && (
                <div className={classes.signature}>
                    {[
                        block.signer === 'guardian' ? t`Name of parent or guardian` : t`Participant name`,
                        t`Signature`,
                        t`Date`,
                    ].map(caption => (
                        <div key={caption} className={classes.signatureColumn}>
                            <span className={classes.signatureLine}/>
                            <span className={classes.signatureCaption}>{caption}</span>
                        </div>
                    ))}
                </div>
            )}
            {block.type === 'separator' && <hr className={classes.separator}/>}

            {selected && (block.type === 'field' || block.type === 'checkbox') && (
                <div className={classes.blockOptions}>
                    <Switch
                        size="xs"
                        label={t`Required`}
                        checked={!!block.required}
                        onChange={(event) => onUpdate({required: event.currentTarget.checked})}
                    />
                </div>
            )}
            {selected && block.type === 'signature' && (
                <div className={classes.blockOptions}>
                    <span className={classes.blockOptionsLabel}>{t`Who signs here?`}</span>
                    <div className={classes.pills}>
                        {(['participant', 'guardian'] as const).map(signer => (
                            <button
                                key={signer}
                                type="button"
                                className={classes.pill}
                                aria-pressed={(block.signer ?? 'participant') === signer}
                                onClick={() => onUpdate({signer})}
                            >
                                {signer === 'participant' ? t`Participant` : t`Parent or guardian`}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Figma « Documents · Éditeur »: the linked events in a dropdown of checkboxes (like the Types
 * filter of the directory), upcoming events only; « Appliquer » links the ones ticked. An event
 * already linked stays in the list after it has passed, so it can be unlinked.
 */
const LinkedEventsMenu = ({events, value, onChange}: {
    events: { id: number, title: string }[],
    value: number[],
    onChange: (ids: number[]) => void,
}) => {
    const [opened, setOpened] = useState(false);
    const [picked, setPicked] = useState<number[]>(value);
    const allIds = events.map(event => event.id);
    const allPicked = allIds.length > 0 && allIds.every(id => picked.includes(id));
    const count = value.length;

    const open = (next: boolean) => {
        if (next) {
            setPicked(value);
        }
        setOpened(next);
    };

    const toggle = (id: number) =>
        setPicked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

    const label = count === 0
        ? t`No event`
        : count === allIds.length && count > 1 ? t`All upcoming events` : t`${count} events`;

    return (
        <Popover opened={opened} onChange={open} position="bottom-start" width="target" offset={6} trapFocus
                 classNames={{dropdown: classes.eventsDropdown}}>
            <Popover.Target>
                <UnstyledButton className={classes.eventsTrigger} aria-expanded={opened} onClick={() => open(!opened)}>
                    <span>{count === 1 ? (events.find(event => event.id === value[0])?.title ?? label) : label}</span>
                    <IconChevronDown size={18} stroke={2}/>
                </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown>
                <div role="group" aria-label={t`Linked events`} className={classes.eventsOptions}>
                    <label className={classes.eventsOption} data-checked={allPicked || undefined}>
                        <input type="checkbox" checked={allPicked} className={classes.eventsInput}
                               onChange={() => setPicked(allPicked ? [] : allIds)}/>
                        <span>{t`All upcoming events`}</span>
                        <span className={classes.eventsBox} aria-hidden>{allPicked && <IconCheck size={14} stroke={3}/>}</span>
                    </label>
                    {events.map(event => {
                        const checked = picked.includes(event.id);
                        return (
                            <label key={event.id} className={classes.eventsOption} data-checked={checked || undefined}>
                                <input type="checkbox" checked={checked} className={classes.eventsInput}
                                       onChange={() => toggle(event.id)}/>
                                <span>{event.title}</span>
                                <span className={classes.eventsBox} aria-hidden>{checked && <IconCheck size={14} stroke={3}/>}</span>
                            </label>
                        );
                    })}
                </div>
                <Button className={classes.eventsApply} onClick={() => {
                    onChange(picked);
                    setOpened(false);
                }}>
                    {t`Apply`}
                </Button>
            </Popover.Dropdown>
        </Popover>
    );
};

const DocumentSettings = ({draft, onChange, onExport}: {
    draft: DocumentDraft,
    onChange: (changes: Partial<DocumentDraft>) => void,
    onExport: () => void,
}) => {
    const {organizerId} = useParams();
    const eventsQuery = useGetOrganizerEvents(organizerId, {perPage: 100, sortBy: 'start_date', sortDirection: 'desc'});
    // Upcoming (not over, not archived), soonest first; plus those already linked.
    const events = useMemo(() => (eventsQuery.data?.data ?? [])
        .filter(event => draft.event_ids.includes(Number(event.id)) || (event.status !== 'ARCHIVED'
            && dayjs(event.end_date ?? event.start_date).isAfter(dayjs())))
        .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
        .map(event => ({id: Number(event.id), title: event.title})), [eventsQuery.data, draft.event_ids]);

    return (
        <div className={classes.settingsBody}>
            <p className={classes.panelLabel}>{t`Settings`}</p>

            <h3 className={classes.settingsTitle}>{t`How is it signed?`}</h3>
            <div className={classes.modes} role="radiogroup">
                {([
                    ['ONLINE', t`Online signature`, t`The participant signs it during checkout. They receive the signed PDF by email.`],
                    ['PRINT', t`PDF to print`, t`Sent with the ticket. The participant brings it signed on site.`],
                ] as const).map(([mode, label, description]) => (
                    <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={draft.signing_mode === mode}
                        className={classes.mode}
                        onClick={() => onChange({signing_mode: mode})}
                    >
                        <span className={classes.modeRadio} aria-hidden/>
                        <span>
                            <span className={classes.modeLabel}>{label}</span>
                            <span className={classes.modeDescription}>{description}</span>
                        </span>
                    </button>
                ))}
            </div>

            <h3 className={classes.settingsTitle}>{t`Who has to fill it in?`}</h3>
            <div className={classes.pills}>
                {([['ALL', t`Everyone`], ['MINORS', t`Minors only`]] as const).map(([audience, label]) => (
                    <button
                        key={audience}
                        type="button"
                        className={classes.pill}
                        aria-pressed={draft.audience === audience}
                        onClick={() => onChange({audience})}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {draft.audience === 'MINORS' && (
                <p className={classes.panelHint}>
                    <Trans>Under 18 on the day of the event, from the date of birth asked at checkout.</Trans>
                </p>
            )}

            <h3 className={classes.settingsTitle}>{t`Linked events`}</h3>
            {eventsQuery.isLoading && <Skeleton height={80} radius="md"/>}
            {!eventsQuery.isLoading && events.length === 0 && (
                <p className={classes.panelHint}>{t`No events yet. Link this document once you create one.`}</p>
            )}
            {events.length > 0 && (
                <>
                    <LinkedEventsMenu events={events} value={draft.event_ids}
                                      onChange={(ids) => onChange({event_ids: ids})}/>
                    <p className={classes.panelHint}>{t`Only upcoming events.`}</p>
                </>
            )}

            <hr className={classes.panelRule}/>
            <Button variant="outline" fullWidth leftSection={<IconDownload size={18}/>} onClick={onExport}>
                {t`Export as PDF`}
            </Button>
        </div>
    );
};

export default DocumentEditor;
