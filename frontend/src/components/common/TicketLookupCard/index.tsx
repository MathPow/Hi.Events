import {Button, Collapse, TextInput, UnstyledButton} from "@mantine/core";
import {useForm} from "@mantine/form";
import {t} from "@lingui/macro";
import {useState} from "react";
import {useNavigate} from "react-router";
import {useSendTicketLookupEmail} from "../../../mutations/useSendTicketLookupEmail.ts";
import {showError} from "../../../utilites/notifications.tsx";
import classes from "./TicketLookupCard.module.scss";

// Buyers have no account: a sand tile that opens on an email field, and the link to their tickets
// goes to that address. On the login and sign-up pages, for those who ended up there looking for them.
export const TicketLookupCard = () => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [sent, setSent] = useState(false);
    const form = useForm({initialValues: {email: ''}});
    const lookup = useSendTicketLookupEmail();

    const submit = (values: { email: string }) => {
        lookup.mutate(values.email, {
            onSuccess: ({token}) => {
                // Sur dev, sans courriel, l'API rend le lien: on y va directement.
                if (token) {
                    navigate(`/my-tickets/${token}`);
                    return;
                }
                setSent(true);
            },
            onError: () => showError(t`Something went wrong. Please try again.`),
        });
    };

    return (
        <div className={classes.ticketLookup} data-rough data-expanded={open}>
            <UnstyledButton className={classes.ticketLookupTrigger} onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className={classes.ticketLookupText}>
                    <strong>{t`Looking for your tickets?`}</strong>
                    <span>{t`No account needed: just the email you used at checkout.`}</span>
                </span>
                <img src={'/interface/fleche-suite.svg'} alt={''} className={classes.arrow}/>
            </UnstyledButton>

            <Collapse in={open}>
                <div className={classes.ticketLookupContent}>
                    {sent ? (
                        <div className={classes.successMessage}>
                            <p>{t`Check your inbox! If tickets are associated with this email, you'll receive a link to view them.`}</p>
                            <UnstyledButton className={classes.resetLink} onClick={() => {
                                setSent(false);
                                form.reset();
                            }}>
                                {t`Try another email`}
                            </UnstyledButton>
                        </div>
                    ) : (
                        <form onSubmit={form.onSubmit(submit)}>
                            <div className={classes.ticketLookupForm}>
                                <TextInput
                                    {...form.getInputProps('email')}
                                    type="email"
                                    placeholder={t`Enter your email`}
                                    aria-label={t`Email`}
                                    required
                                    className={classes.ticketEmailInput}
                                />
                                <Button type="submit" loading={lookup.isPending} disabled={lookup.isPending}>
                                    {t`Send`}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </Collapse>
        </div>
    );
};
