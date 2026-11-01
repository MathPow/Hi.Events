import {t} from "@lingui/macro";
import {TextInput} from "@mantine/core";
import {FormEvent, useEffect, useId, useState} from "react";
import {useNavigate} from "react-router";
import {useGetMe} from "../../../queries/useGetMe.ts";
import {openAssistant} from "../../../utilites/assistantEvents.ts";
import {returnHereAfterLogin} from "../../../api/client.ts";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from "./Help.module.scss";

/**
 * Asks the organizer assistant (components/common/Assistant) from the help center: signed in,
 * the panel opens and answers; otherwise the login comes first, then this page again, the
 * question still in the field.
 */
export const AskAssistant = ({title}: { title?: string }) => {
    const id = useId();
    const me = useGetMe();
    const navigate = useNavigate();
    const [question, setQuestion] = useState('');
    const signedIn = me.isSuccess && !!me.data?.id;

    // Back from the login, with the question asked before it.
    useEffect(() => {
        const asked = new URLSearchParams(window.location.search).get('question');
        if (asked) {
            setQuestion(asked);
        }
    }, []);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const asked = question.trim();
        if (!asked) {
            return;
        }
        if (signedIn) {
            openAssistant(asked);
            setQuestion('');
            return;
        }
        returnHereAfterLogin(`${window.location.pathname}?question=${encodeURIComponent(asked)}`);
        navigate('/auth/login');
    };

    return (
        <section className={`${shell.card} ${classes.ask}`} data-rough aria-labelledby={id}>
            <span className={classes.askIcon} aria-hidden="true"/>
            <div className={classes.askText}>
                <h2 id={id} className={classes.askTitle}>{title ?? t`Ask the assistant`}</h2>
                <p>
                    {signedIn
                        ? t`It knows Billetterie Dehors and your account: it reads your events and orders, and only changes something once you approve it.`
                        : t`It knows Billetterie Dehors and can read your events and orders. Sign in to your organizer account to ask it.`}
                </p>
            </div>
            <form className={classes.askForm} onSubmit={submit}>
                <TextInput value={question} onChange={(event) => setQuestion(event.currentTarget.value)}
                           placeholder={t`E.g. How do I refund an order?`} aria-label={t`Your question`}
                           classNames={{root: classes.askField, input: classes.askInput}}/>
                <button type="submit" className={`${shell.button} ${shell.buttonFilled} ${classes.askButton}`}
                        data-rough="button">
                    {signedIn ? t`Ask` : t`Sign in to ask`}
                </button>
            </form>
        </section>
    );
};
