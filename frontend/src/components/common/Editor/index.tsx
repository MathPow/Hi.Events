import {Link, RichTextEditor} from "@mantine/tiptap";
import {useEditor} from "@tiptap/react";
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import React, {useEffect, useRef, useState} from "react";
import {InputDescription, InputError, InputLabel, MantineFontSize} from "@mantine/core";
import classes from "./Editor.module.scss";
import classNames from "classnames";
import {Trans} from "@lingui/macro";
import {InsertImageControl} from "./Controls/InsertImageControl";
import {ImageResize} from "./Extensions/ImageResizeExtension";
import {Extension} from '@tiptap/core';

const COLORS = ['#25262b', '#868e96', '#fa5252', '#e64980', '#be4bdb', '#7950f2', '#4c6ef5', '#228be6',
    '#15aabf', '#12b886', '#40c057', '#82c91e', '#fab005', '#fd7e14'];

// The icons of the « Paramètres » mockup (public/interface/admin/parametres).
const minimalIcon = (name: string) => () => <img src={`/interface/admin/parametres/${name}.svg`} alt=""/>;
const MINIMAL_ICONS = {
    bold: minimalIcon('gras'),
    italic: minimalIcon('italique'),
    link: minimalIcon('lien'),
    list: minimalIcon('liste'),
};

interface EditorProps {
    onChange: (value: string) => void;
    value: string;
    label?: React.ReactNode;
    description?: React.ReactNode;
    required?: boolean;
    className?: string;
    error?: string | React.ReactNode;
    // 'minimal': bold, italic, link and list only (organizer description). 'plain': no bar at all,
    // written like a text box but still kept as HTML (the messages of the event's settings).
    editorType?: 'full' | 'simple' | 'minimal' | 'plain';
    // When the text loses the focus (fields that save themselves).
    onBlur?: () => void;
    maxLength?: number;
    size?: MantineFontSize;
    additionalExtensions?: Extension[];
    additionalToolbarControls?: React.ReactNode;
    // Couleur et alignement du texte: les courriels seulement. Ailleurs (descriptions,
    // messages des pages publiques), le texte garde la typo et les couleurs de Dehors, et
    // ce qu'on colle perd les siennes.
    allowTextStyling?: boolean;
}

export const Editor = ({
                           error,
                           onChange,
                           value,
                           label = '',
                           required = false,
                           className = '',
                           description = '',
                           editorType = 'full',
                           maxLength,
                           size = 'md',
                           additionalExtensions = [],
                           additionalToolbarControls,
                           allowTextStyling = false,
                           onBlur,
                       }: EditorProps) => {
    const [charError, setCharError] = useState<string | null | React.ReactNode>(null);
    const onBlurRef = useRef(onBlur);
    onBlurRef.current = onBlur;

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                paragraph: {
                    HTMLAttributes: {
                        style: 'margin: 0.5em 0;'
                    }
                },
                hardBreak: {
                    HTMLAttributes: {
                        'data-type': 'hard-break'
                    }
                }
            }),
            Underline,
            Link,
            ImageResize,
            ...(allowTextStyling ? [TextAlign.configure({types: ['heading', 'paragraph']}), TextStyle, Color] : []),
            ...additionalExtensions
        ],
        onBlur: () => onBlurRef.current?.(),
        onUpdate: ({editor}) => {
            const html = editor.getHTML();
            const htmlLength = html.length;

            if (maxLength && htmlLength > maxLength) {
                setCharError(`Character limit exceeded: ${htmlLength}/${maxLength}`);
            } else {
                setCharError(null);
            }

            onChange(html);
        },
    });

    useEffect(() => {
        if (value && editor) {
            if (value !== editor.getHTML()) {
                editor.commands.setContent(value, false, {preserveWhitespace: "full"});
            }
            const htmlLength = value.length;

            if (maxLength && htmlLength > maxLength) {
                setCharError(<Trans>HTML character limit exceeded: {htmlLength}/{maxLength}</Trans>);
            } else {
                setCharError(null);
            }
        }
    }, [value, editor, maxLength]);

    return (
        <div className={classNames([classes.inputWrapper, className])}>
            {label && <InputLabel size={size} required={required}
                                  onClick={() => editor?.commands.focus()}>{label}</InputLabel>}
            {description && (
                <div style={{marginBottom: 5}}>
                    <InputDescription size={size}>{description}</InputDescription>
                </div>
            )}
            <RichTextEditor variant={'subtle'} editor={editor}>
                {editorType !== 'plain' && <RichTextEditor.Toolbar sticky className={classes.toolbar}>
                    {editorType === 'full' && (
                        <>
                            <RichTextEditor.ControlsGroup>
                                <RichTextEditor.Bold/>
                                <RichTextEditor.Italic/>
                                <RichTextEditor.Underline/>
                                <RichTextEditor.ClearFormatting/>
                                {allowTextStyling && <RichTextEditor.ColorPicker colors={COLORS}/>}
                            </RichTextEditor.ControlsGroup>

                            <RichTextEditor.ControlsGroup>
                                <RichTextEditor.H1/>
                                <RichTextEditor.H2/>
                                <RichTextEditor.H3/>
                                <RichTextEditor.H4/>
                            </RichTextEditor.ControlsGroup>

                            <RichTextEditor.ControlsGroup>
                                <RichTextEditor.BulletList/>
                                <RichTextEditor.OrderedList/>
                            </RichTextEditor.ControlsGroup>

                            <RichTextEditor.ControlsGroup>
                                <RichTextEditor.Link/>
                                <RichTextEditor.Unlink/>
                            </RichTextEditor.ControlsGroup>

                            {allowTextStyling && (
                                <RichTextEditor.ControlsGroup>
                                    <RichTextEditor.AlignLeft/>
                                    <RichTextEditor.AlignCenter/>
                                    <RichTextEditor.AlignJustify/>
                                    <RichTextEditor.AlignRight/>
                                </RichTextEditor.ControlsGroup>
                            )}
                            <RichTextEditor.ControlsGroup>
                                <InsertImageControl/>
                            </RichTextEditor.ControlsGroup>
                        </>
                    )}

                    {editorType === 'minimal' && (
                        <RichTextEditor.ControlsGroup>
                            <RichTextEditor.Bold icon={MINIMAL_ICONS.bold}/>
                            <RichTextEditor.Italic icon={MINIMAL_ICONS.italic}/>
                            <RichTextEditor.Link icon={MINIMAL_ICONS.link}/>
                            <RichTextEditor.BulletList icon={MINIMAL_ICONS.list}/>
                        </RichTextEditor.ControlsGroup>
                    )}

                    {editorType === 'simple' && (
                        <>
                            <RichTextEditor.ControlsGroup>
                                <RichTextEditor.Bold/>
                                <RichTextEditor.Italic/>
                                <RichTextEditor.Underline/>
                                <RichTextEditor.ClearFormatting/>
                                {allowTextStyling && <RichTextEditor.ColorPicker colors={COLORS}/>}
                            </RichTextEditor.ControlsGroup>

                            <RichTextEditor.ControlsGroup>
                                <RichTextEditor.Link/>
                                <RichTextEditor.Unlink/>
                            </RichTextEditor.ControlsGroup>

                            {allowTextStyling && (
                                <RichTextEditor.ControlsGroup>
                                    <RichTextEditor.AlignLeft/>
                                    <RichTextEditor.AlignCenter/>
                                    <RichTextEditor.AlignRight/>
                                </RichTextEditor.ControlsGroup>
                            )}

                            <RichTextEditor.ControlsGroup>
                                <RichTextEditor.BulletList/>
                                <RichTextEditor.OrderedList/>
                            </RichTextEditor.ControlsGroup>
                            <RichTextEditor.ControlsGroup>
                                <InsertImageControl/>
                            </RichTextEditor.ControlsGroup>
                        </>
                    )}
                    
                    {additionalToolbarControls}
                </RichTextEditor.Toolbar>}

                <RichTextEditor.Content/>
            </RichTextEditor>
            {(charError || error) && (
                <div className={classes.error}>
                    <InputError>{error || charError}</InputError>
                </div>
            )}
        </div>
    );
};
