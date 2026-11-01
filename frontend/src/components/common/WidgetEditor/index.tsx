import classes from './WidgetEditor.module.scss';
import SelectProducts from "../../routes/product-widget/SelectProducts";
import {Button, ColorInput, CopyButton, NumberInput, Skeleton, TextInput} from "@mantine/core";
import {t} from "@lingui/macro";
import {matches, useForm} from "@mantine/form";
import {useEffect, useState} from "react";
import {useParams} from "react-router";
import {IconCheck, IconCopy} from "@tabler/icons-react";
import {useGetEventSettings} from "../../../queries/useGetEventSettings.ts";
import {Event} from '../../../types.ts';
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {PageTitle} from "../PageTitle";
import {PillChoice, ToggleRow} from "../../routes/organizer/Settings/SettingsUi.tsx";

// A piece of code to paste, with its copy button.
const CodeBlock = ({label, hint, code}: { label: string, hint: string, code: string }) => (
    <div className={classes.codeBlock}>
        <div className={classes.codeHead}>
            <div className={classes.codeText}>
                <span className={classes.codeLabel}>{label}</span>
                <span className={classes.codeHint}>{hint}</span>
            </div>
            <CopyButton value={code} timeout={2000}>
                {({copied, copy}) => (
                    <Button
                        variant="transparent"
                        className={classes.copyButton}
                        data-copied={copied || undefined}
                        leftSection={copied ? <IconCheck size={16} stroke={2.5}/> : <IconCopy size={16} stroke={2}/>}
                        onClick={copy}
                    >
                        {copied ? t`Copied` : t`Copy the code`}
                    </Button>
                )}
            </CopyButton>
        </div>
        <pre className={classes.code}><code>{code.trim()}</code></pre>
    </div>
);

export const WidgetEditor = () => {
    const {eventId} = useParams();
    const eventQuery = useGetEvent(eventId);

    const colorMessage = t`Color must be a valid hex color code. Example: #ffffff`;
    const colorRegex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    const {data: eventSettings, isFetched: isEventSettingsFetched} = useGetEventSettings(eventId);
    const form = useForm({
        initialValues: {
            background_color: "#ffffff",
            primary_color: "#828282",
            primary_text_color: "#ffffff",
            secondary_color: "#f5f5f5",
            secondary_text_color: "#828282",
            continue_button_text: t`Continue`,
            padding: 20,
            autoResize: true,
        },
        validate: {
            background_color: matches(colorRegex, colorMessage),
            primary_color: matches(colorRegex, colorMessage),
            primary_text_color: matches(colorRegex, colorMessage),
            secondary_color: matches(colorRegex, colorMessage),
            secondary_text_color: matches(colorRegex, colorMessage),
        },
    });

    const [htmlEmbedCode, setHtmlEmbedCode] = useState<string>("");
    const [reactComponentCode, setReactComponentCode] = useState<string>("");
    const [reactUsageCode, setReactUsageCode] = useState<string>("");
    const [codeType, setCodeType] = useState<'html' | 'react'>('html');
    const currentLocation = typeof window !== "undefined" ? window?.location : undefined;
    const embedUrl = `${currentLocation?.protocol}//${currentLocation?.host}/widget.js`;
    const embedScript = `<script async src="${embedUrl}"></script>`;

    useEffect(() => {
        setHtmlEmbedCode(
            '<div ' +
            'data-hievents-id="' + eventId + '" ' +
            'data-hievents-primary-color="' + form.values.primary_color + '" ' +
            'data-hievents-primary-text-color="' + form.values.primary_text_color + '" ' +
            'data-hievents-secondary-color="' + form.values.secondary_color + '" ' +
            'data-hievents-secondary-text-color="' + form.values.secondary_text_color + '" ' +
            'data-hievents-background-color="' + form.values.background_color + '" ' +
            'data-hievents-widget-type="widget" ' +
            'data-hievents-widget-version="1.0" ' +
            'data-hievents-locale="en" ' +
            'data-hievents-padding="' + form.values.padding + 'px" ' +
            'data-hievents-autoresize="' + form.values.autoResize + '" ' +
            'data-hievents-continue-button-text="' + form.values.continue_button_text + '" ' +
            'class="hievents-widget">' +
            '</div>'
        );

        setReactComponentCode(`
import React, { useEffect } from 'react';

const HiEventsWidget = ({
  eventId,
  primaryColor = "${form.values.primary_color}",
  primaryTextColor = "${form.values.primary_text_color}",
  secondaryColor = "${form.values.secondary_color}",
  secondaryTextColor = "${form.values.secondary_text_color}",
  backgroundColor = "${form.values.background_color}",
  widgetType = "widget",
  widgetVersion = "1.0",
  locale = "en"
}) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "${embedUrl}";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div
      data-hievents-id={eventId}
      data-hievents-primary-color={primaryColor}
      data-hievents-primary-text-color={primaryTextColor}
      data-hievents-secondary-color={secondaryColor}
      data-hievents-secondary-text-color={secondaryTextColor}
      data-hievents-background-color={backgroundColor}
      data-hievents-widget-type={widgetType}
      data-hievents-widget-version={widgetVersion}
      data-hievents-locale={locale}
      className="hievents-widget"
    />
  );
};

export default HiEventsWidget;
        `);

        setReactUsageCode(`
import React from 'react';
import HiEventsWidget from './HiEventsWidget';

const App = () => {
  return (
    <div>
      <h1>My Website</h1>
      <HiEventsWidget 
        eventId="${eventId}"
        primaryColor="${form.values.primary_color}"
        primaryTextColor="${form.values.primary_text_color}"
        secondaryColor="${form.values.secondary_color}"
        secondaryTextColor="${form.values.secondary_text_color}"
        backgroundColor="${form.values.background_color}"
        widgetType="widget"
        widgetVersion="1.0"
        locale="en"
      />
    </div>
  );
};

export default App;
        `);

        form.validate();
    }, [form.values, eventId]);

    useEffect(() => {
        if (eventSettings) {
            form.setValues({
                background_color: eventSettings.homepage_background_color || form.values.background_color,
                primary_color: eventSettings.homepage_primary_color || form.values.primary_color,
                primary_text_color: eventSettings.homepage_primary_text_color || form.values.primary_text_color,
                secondary_color: eventSettings.homepage_secondary_color || form.values.secondary_color,
                secondary_text_color: eventSettings.homepage_secondary_text_color || form.values.secondary_text_color,
                continue_button_text: eventSettings.continue_button_text || t`Continue`,
            });
        }
    }, [isEventSettingsFetched, eventSettings]);

    const colorField = (field: 'background_color' | 'primary_color' | 'primary_text_color' | 'secondary_color' | 'secondary_text_color', label: string) => (
        <ColorInput
            className={classes.field}
            label={label}
            placeholder="#RRGGBB"
            {...form.getInputProps(field)}
        />
    );

    return (
        <div className={classes.page}>
            <PageTitle subheading={t`Create a custom widget to sell tickets on your site.`}>
                {t`Widget Embed`}
            </PageTitle>

            <div className={classes.layout}>
                <div className={classes.settings}>
                    <section className={classes.card}>
                        <div className={classes.cardHead}>
                            <h2 className={classes.cardTitle}>{t`Colors`}</h2>
                            <p className={classes.cardSubtitle}>{t`These settings apply only to copied embed code and won't be stored.`}</p>
                        </div>
                        <div className={classes.fields}>
                            {colorField('background_color', t`Background Color`)}
                            {colorField('primary_color', t`Primary Color`)}
                            {colorField('primary_text_color', t`Primary Text Color`)}
                            {colorField('secondary_color', t`Secondary Color`)}
                            {colorField('secondary_text_color', t`Secondary Text Color`)}
                        </div>
                    </section>

                    <section className={classes.card}>
                        <div className={classes.cardHead}>
                            <h2 className={classes.cardTitle}>{t`Appearance`}</h2>
                        </div>
                        <div className={classes.fields}>
                            <TextInput
                                className={classes.field}
                                label={t`Continue Button Text`}
                                placeholder={t`Continue`}
                                {...form.getInputProps('continue_button_text')}
                            />
                            <NumberInput
                                className={classes.field}
                                label={t`Padding`}
                                min={0}
                                max={500}
                                placeholder="20"
                                suffix=" px"
                                {...form.getInputProps('padding')}
                            />
                        </div>
                        <ToggleRow
                            label={t`Auto Resize`}
                            hint={t`Automatically resize the widget height based on the content. When disabled, the widget will fill the height of the container.`}
                            checked={form.values.autoResize}
                            onChange={(checked) => form.setFieldValue('autoResize', checked)}
                        />
                    </section>
                </div>

                <section className={classes.preview} aria-label={t`Widget Preview`}>
                    <div className={classes.browserBar}>
                        <span className={classes.dots} aria-hidden>
                            <span/><span/><span/>
                        </span>
                        <span className={classes.address}>{t`your-website.com`}</span>
                    </div>
                    <div className={classes.website}>
                        <span className={classes.placeholderTitle} aria-hidden/>
                        <span className={classes.placeholderLine} aria-hidden/>
                        <span className={`${classes.placeholderLine} ${classes.placeholderShort}`} aria-hidden/>

                        <div className={classes.widgetWrapper} data-dehors-apercu>
                            {!eventQuery.isFetched ? (
                                <Skeleton height={240} radius={16}/>
                            ) : (
                                <SelectProducts
                                    event={eventQuery.data as Event}
                                    widgetMode={'preview'}
                                    colors={{
                                        primary: form.values.primary_color,
                                        primaryText: form.values.primary_text_color,
                                        secondary: form.values.secondary_color,
                                        secondaryText: form.values.secondary_text_color,
                                        background: form.values.background_color,
                                    }}
                                    continueButtonText={form.values.continue_button_text}
                                    padding={form.values.padding + 'px'}
                                />
                            )}
                        </div>

                        <span className={classes.placeholderLine} aria-hidden/>
                        <span className={`${classes.placeholderLine} ${classes.placeholderShort}`} aria-hidden/>
                    </div>
                </section>
            </div>

            <section className={`${classes.card} ${classes.codeCard}`}>
                <div className={classes.codeCardHead}>
                    <div className={classes.cardHead}>
                        <h2 className={classes.cardTitle}>{t`Embed Code`}</h2>
                        <p className={classes.cardSubtitle}>{t`Copy it into your website: the widget follows the colors chosen above.`}</p>
                    </div>
                    <PillChoice
                        label={t`Embed Code`}
                        value={codeType}
                        // eslint-disable-next-line lingui/no-unlocalized-strings
                        options={[{value: 'html', label: 'HTML'}, {value: 'react', label: 'React'}]}
                        onChange={setCodeType}
                    />
                </div>
                {codeType === 'html' ? (
                    <div className={classes.codeGrid}>
                        <CodeBlock label={t`Embed Script`} hint={t`Place this in the <head> of your website.`} code={embedScript}/>
                        <CodeBlock label={t`Embed Code`} hint={t`Paste this where you want the widget to appear.`} code={htmlEmbedCode}/>
                    </div>
                ) : (
                    <div className={classes.codeGrid}>
                        <CodeBlock
                            label={t`Component Code`}
                            hint={t`Here is the React component you can use to embed the widget in your application.`}
                            code={reactComponentCode}
                        />
                        <CodeBlock
                            label={t`Usage Example`}
                            hint={t`Here is an example of how you can use the component in your application.`}
                            code={reactUsageCode}
                        />
                    </div>
                )}
            </section>
        </div>
    );
};
