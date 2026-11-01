import {MutableRefObject, useEffect, useRef} from "react";
import {Editor, Extension, JSONContent, mergeAttributes, Node} from "@tiptap/core";
import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {Plugin} from "@tiptap/pm/state";
import {Decoration, DecorationSet} from "@tiptap/pm/view";
import {autoFieldLabel} from "../../../../common/OrganizerDocument/blocks.ts";

// single: une ligne (titre, clause, case); multi: des paragraphes; list: une liste a puces.
export type RichBlockKind = 'single' | 'multi' | 'list';

/** Un champ automatique dans le texte (nom du participant...), rempli pour chacun. */
export const FieldChip = Node.create({
    name: 'field',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
        return {
            key: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('data-field'),
                renderHTML: (attributes: { key: string | null }) => ({'data-field': attributes.key}),
            },
        };
    },

    parseHTML() {
        return [{tag: 'span[data-field]'}];
    },

    renderHTML({node, HTMLAttributes}) {
        return ['span', mergeAttributes(HTMLAttributes, {class: 'doc-field-chip', contenteditable: 'false'}), autoFieldLabel(node.attrs.key)];
    },

    renderText({node}) {
        return `[${autoFieldLabel(node.attrs.key)}]`;
    },
});

const documentNode = (kind: RichBlockKind) => Node.create({
    name: 'doc',
    topNode: true,
    content: kind === 'single' ? 'paragraph' : kind === 'list' ? 'bulletList' : 'paragraph+',
});

/** Le texte gris d'un bloc vide. */
const placeholder = (text: string) => Extension.create({
    name: 'blockPlaceholder',
    addProseMirrorPlugins() {
        return [new Plugin({
            props: {
                decorations: (state) => {
                    const {doc} = state;
                    if (doc.textContent !== '' || doc.firstChild?.childCount && doc.firstChild.childCount > 1) {
                        return null;
                    }
                    let decoration: Decoration | null = null;
                    doc.descendants((node, position) => {
                        if (decoration || !node.isTextblock) {
                            return !decoration;
                        }
                        if (node.content.size === 0) {
                            decoration = Decoration.node(position, position + node.nodeSize, {
                                class: 'is-empty',
                                'data-placeholder': text,
                            });
                        }
                        return false;
                    });
                    return decoration ? DecorationSet.create(doc, [decoration]) : null;
                },
            },
        })];
    },
});

interface Callbacks {
    onChange: (content: JSONContent) => void;
    onFocus?: (editor: Editor) => void;
    // Entree dans un bloc d'une ligne: un nouveau bloc dessous.
    onEnter?: () => void;
    // Retour arriere dans un bloc vide: on le retire.
    onBackspaceEmpty?: () => void;
}

const keyHandling = (kind: RichBlockKind, callbacks: MutableRefObject<Callbacks>) => Extension.create({
    name: 'blockKeys',
    addKeyboardShortcuts() {
        return {
            Enter: ({editor}) => {
                if (kind !== 'single' || !callbacks.current.onEnter) {
                    return false;
                }
                // Ce qu'on tape ensuite va au nouveau bloc, pas a celui-ci.
                editor.commands.blur();
                callbacks.current.onEnter();
                return true;
            },
            Backspace: ({editor}) => {
                if (!editor.isEmpty || !callbacks.current.onBackspaceEmpty) {
                    return false;
                }
                callbacks.current.onBackspaceEmpty();
                return true;
            },
        };
    },
});

interface RichBlockEditorProps extends Callbacks {
    blockId: string;
    kind: RichBlockKind;
    content?: JSONContent;
    placeholder: string;
    className?: string;
    registerEditor: (blockId: string, editor: Editor | null) => void;
}

/**
 * Le texte d'un bloc du document: gras, italique, sauts de ligne et champs
 * automatiques; une liste a puces pour le bloc liste. Le contenu de depart est
 * lu une fois, ensuite c'est l'editeur qui le tient (onChange).
 */
export const RichBlockEditor = ({
                                    blockId,
                                    kind,
                                    content,
                                    placeholder: placeholderText,
                                    className,
                                    registerEditor,
                                    ...callbacks
                                }: RichBlockEditorProps) => {
    const callbacksRef = useRef<Callbacks>(callbacks);
    callbacksRef.current = callbacks;

    const editor = useEditor({
        // Cree au rendu (jamais rendu cote serveur: la feuille attend le document), pour que le
        // bloc ajoute par Entree ait le curseur avant la lettre suivante.
        immediatelyRender: typeof window !== 'undefined',
        extensions: [
            documentNode(kind),
            StarterKit.configure({
                document: false,
                heading: false,
                blockquote: false,
                codeBlock: false,
                code: false,
                horizontalRule: false,
                orderedList: false,
                strike: false,
                dropcursor: false,
                gapcursor: false,
                bulletList: kind === 'list' ? {} : false,
                listItem: kind === 'list' ? {} : false,
            }),
            FieldChip,
            placeholder(placeholderText),
            keyHandling(kind, callbacksRef),
        ],
        content,
        onUpdate: ({editor: updated}) => callbacksRef.current.onChange(updated.getJSON()),
        onFocus: ({editor: focused}) => callbacksRef.current.onFocus?.(focused),
    });

    useEffect(() => {
        registerEditor(blockId, editor);
        return () => registerEditor(blockId, null);
    }, [blockId, editor, registerEditor]);

    return <EditorContent editor={editor} className={className}/>;
};
