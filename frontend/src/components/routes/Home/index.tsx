import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Accordion, Button } from '@mantine/core';
import { t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Helmet } from 'react-helmet-async';
import {
    IconArrowDown,
    IconArrowRight,
    IconArrowUpRight,
    IconCalendarEvent,
    IconCheck,
    IconCreditCard,
    IconQrcode,
    IconSparkles,
    IconTicket,
} from '@tabler/icons-react';
import { dynamicActivateLocale } from '../../../locales';
import { useGetMe } from '../../../queries/useGetMe';
import { captureUtmData } from '../../../utilites/utm';
import { PoweredByFooter } from '../../common/PoweredByFooter';
import classes from './Home.module.scss';

const BRAND_NAME = 'dehors';

const Home = () => {
    const { i18n } = useLingui();
    const { search } = useLocation();
    const me = useGetMe();
    const [openQuestion, setOpenQuestion] = useState<string | null>(null);
    const registerUrl = `/auth/register${search}`;
    const accountUrl = me.isSuccess ? `/manage/events${search}` : `/auth/login${search}`;
    const accountLabel = me.isSuccess ? t`My events` : t`Log in`;
    const startUrl = me.isSuccess ? accountUrl : registerUrl;
    const alternateLocale = i18n.locale === 'fr' ? 'en' : 'fr';
    const alternateLanguageName = new Intl.DisplayNames([alternateLocale], {type: 'language'}).of(alternateLocale);

    useEffect(() => {
        captureUtmData();
        document.cookie = `locale=${i18n.locale};path=/;max-age=31536000;SameSite=Lax`;
    }, [i18n.locale, search]);

    const features = [
        {
            icon: IconCalendarEvent,
            title: t`One date or a whole series`,
            description: t`Single events, recurring dates, and ticket categories. Make room for every idea.`,
        },
        {
            icon: IconSparkles,
            title: t`Your event, your colours`,
            description: t`Customise your event page, share promo codes, and add ticket sales to your website.`,
        },
        {
            icon: IconQrcode,
            title: t`A warm welcome, a quick scan`,
            description: t`Scan tickets with a phone. Your door team only needs a link, with no app to install.`,
        },
        {
            icon: IconTicket,
            title: t`Stay in the loop`,
            description: t`Track sales, export attendee lists, manage waitlists, and issue full or partial refunds.`,
        },
    ];
    const steps = [
        { title: t`Make it yours`, description: t`Add your event, your colours, and your free or paid tickets.` },
        {
            title: t`Connect your Stripe`,
            description: t`Connect your Stripe account to accept payments. Free events can skip this step.`,
        },
        { title: t`Bring people together`, description: t`Publish your page, share the link, and welcome your crowd.` },
    ];
    const faqs = [
        {
            question: t`Can I organise a free event?`,
            answer: t`Yes! Create free tickets, manage registrations, and scan tickets at the door. No Stripe account is needed for free events.`,
        },
        {
            question: t`Can I use my own Stripe account?`,
            answer: t`Yes. Connect your Stripe account from your organiser settings. Payments are processed through Stripe, where you can follow your payouts.`,
        },
        {
            question: t`Who pays the ticketing fees?`,
            answer: t`You choose: add the platform fee to the ticket price or absorb it. Stripe payment processing fees are separate.`,
        },
        {
            question: t`Is Dehors only for outdoor events?`,
            answer: t`Nope! Concerts, workshops, community gatherings, and online events all belong here. Indoors or outdoors, what matters is bringing people together.`,
        },
    ];

    return (
        <div className={classes.page} lang={i18n.locale}>
            <Helmet>
                <title>{t`Dehors — Quebec ticketing that brings people together`}</title>
                <meta
                    name="description"
                    content={t`Quebec ticketing for free and paid events. Low fees, your own Stripe account, and everything you need to bring people together.`}
                />
                <meta property="og:title" content={t`Dehors — Quebec ticketing that brings people together`} />
                <meta
                    property="og:description"
                    content={t`Quebec ticketing for free and paid events. Low fees, your own Stripe account, and everything you need to bring people together.`}
                />
                <meta property="og:type" content="website" />
                <link rel="icon" type="image/svg+xml" href="/images/dehors/dehors-icone.svg" />
                <link rel="preload" href="/fonts/dehors/fatfrank.otf" as="font" type="font/otf" crossOrigin="anonymous" />
                <link rel="preload" href="/fonts/dehors/allotrope-medium.otf" as="font" type="font/otf" crossOrigin="anonymous" />
            </Helmet>

            <a className={classes.skipLink} href="#main">{t`Skip to content`}</a>

            <header className={classes.header}>
                <Link to={`/${search}`} className={classes.wordmark} aria-label={BRAND_NAME}>
                    <img src="/images/dehors/dehors-icone.svg" width={31} height={36} alt="" />
                    <span className={classes.brandName} aria-hidden="true" />
                </Link>
                <nav className={classes.navigation} aria-label={t`Main navigation`}>
                    <a href="#pourquoi">{t`Why Dehors?`}</a>
                    <a href="#comment">{t`How it works`}</a>
                    <a href="#frais">{t`The fees`}</a>
                </nav>
                <div className={classes.headerActions}>
                    <Button
                        variant="subtle"
                        className={classes.languageButton}
                        aria-label={alternateLanguageName}
                        lang={alternateLocale}
                        data-testid="home-language-toggle"
                        onClick={() => void dynamicActivateLocale(alternateLocale)}
                    >
                        {alternateLocale.toUpperCase()}
                    </Button>
                    <Link to={accountUrl} className={classes.login}>
                        {accountLabel}
                    </Link>
                    <Button
                        component={Link}
                        to={startUrl}
                        className={classes.button}
                        rightSection={<IconArrowUpRight size={18} aria-hidden="true" />}
                    >
                        {t`Get started`}
                    </Button>
                </div>
            </header>

            <main id="main">
                <section className={classes.hero} aria-labelledby="hero-title">
                    <div className={classes.heroCopy}>
                        <span className={classes.eyebrow}>
                            <span className={classes.localDot} /> {t`Quebec roots. People first.`}
                        </span>
                        <h1 id="hero-title">
                            {t`Lower fees.`}
                            <br />
                            <span>{t`More together.`}</span>
                        </h1>
                        <p
                            className={classes.intro}
                        >{t`You bring people together. We handle the tickets. Quebec ticketing with low fees, for your biggest ideas and your smallest gatherings.`}</p>
                        <Button
                            component={Link}
                            to={startUrl}
                            size="lg"
                            className={classes.button}
                            data-testid="home-create-event"
                            rightSection={<IconArrowUpRight size={22} aria-hidden="true" />}
                        >
                            {t`Create my event`}
                        </Button>
                        <p className={classes.heroNote}>
                            <IconCheck size={16} aria-hidden="true" /> {t`Free or paid. Always your event.`}
                        </p>
                    </div>
                    <div className={classes.heroVisual}>
                        <div className={classes.photo}>
                            <img
                                src="/images/dehors/automne.webp"
                                alt=""
                                width={1600}
                                height={1066}
                                fetchPriority="high"
                            />
                            <div className={classes.photoCaption}>
                                <span className={classes.brandName} role="img" aria-label={BRAND_NAME} />
                                <IconArrowUpRight size={32} aria-hidden="true" />
                            </div>
                        </div>
                        <div className={classes.quebecStamp}>
                            <span aria-hidden="true">⚜</span>
                            <span>{t`Made in Quebec`}</span>
                        </div>
                        <div className={classes.ticket}>
                            <div className={classes.ticketContent}>
                                <span className={classes.ticketEyebrow}>{t`Your next good time`}</span>
                                <strong>{t`It starts here.`}</strong>
                                <div className={classes.ticketRule} />
                                <span>{t`One ticket. A whole lot of memories.`}</span>
                            </div>
                            <div className={classes.ticketStub}>
                                <span className={classes.sunDoodle} aria-hidden="true" />
                            </div>
                        </div>
                        <span className={classes.heroDoodle} aria-hidden="true" />
                    </div>
                </section>

                <div className={classes.manifesto}>
                    <p>{t`For the people who make things happen.`}</p>
                    <a href="#pourquoi" aria-label={t`Why Dehors?`}>
                        <IconArrowDown size={22} />
                    </a>
                    <span>{t`Concerts. Workshops. Festivals. Your thing.`}</span>
                </div>

                <section id="pourquoi" className={classes.why} aria-labelledby="why-title">
                    <div className={classes.sectionHeading}>
                        <span className={classes.eyebrow}>{t`Why Dehors?`}</span>
                        <h2 id="why-title">{t`Big on gatherings. Small on fees.`}</h2>
                    </div>
                    <div className={classes.benefits}>
                        <article>
                            <span className={classes.benefitNumber}>01 /</span>
                            <h3>{t`From here. For here.`}</h3>
                            <p>{t`A Quebec ticketing platform for the organisations, collectives, and people who make our communities come alive.`}</p>
                        </article>
                        <article>
                            <span className={classes.benefitNumber}>02 /</span>
                            <h3>{t`Keep more for your event.`}</h3>
                            <p>{t`Low ticketing fees, so more of your budget goes into the experience. Free tickets stay free.`}</p>
                        </article>
                        <article>
                            <span className={classes.benefitNumber}>03 /</span>
                            <h3>{t`Bring your Stripe.`}</h3>
                            <p>{t`Your Stripe account, connected to your ticketing. Keep your payments and payouts in a place you know.`}</p>
                        </article>
                    </div>
                </section>

                <section id="frais" className={classes.pricing} aria-labelledby="fees-title">
                    <div className={classes.pricingCopy}>
                        <span className={classes.eyebrow}>{t`The fees`}</span>
                        <h2 id="fees-title">{t`More in your budget. More in your event.`}</h2>
                        <p>{t`Low ticketing fees, so more of your budget goes into the experience. Free tickets stay free.`}</p>
                        <a href="#questions" onClick={() => setOpenQuestion('question-2')} className={classes.textLink}>
                            {t`Who pays the ticketing fees?`} <IconArrowUpRight size={19} aria-hidden="true" />
                        </a>
                    </div>
                    <div className={classes.priceOptions}>
                        <div className={classes.priceCard}>
                            <IconTicket size={28} stroke={1.5} aria-hidden="true" />
                            <h3>{t`Free events`}</h3>
                            <strong className={classes.price}>
                                {new Intl.NumberFormat(i18n.locale, {
                                    style: 'currency',
                                    currency: 'CAD',
                                    currencyDisplay: 'narrowSymbol',
                                    maximumFractionDigits: 0,
                                }).format(0)}
                            </strong>
                            <p>{t`No ticketing fees. Just good company.`}</p>
                            <span>
                                <IconCheck size={16} aria-hidden="true" /> {t`No Stripe account needed`}
                            </span>
                        </div>
                        <div className={`${classes.priceCard} ${classes.paidCard}`}>
                            <IconCreditCard size={28} stroke={1.5} aria-hidden="true" />
                            <h3>{t`Paid events`}</h3>
                            <strong className={classes.price}>
                                {new Intl.NumberFormat(i18n.locale, {
                                    style: 'percent',
                                    maximumFractionDigits: 1,
                                }).format(0.025)}
                            </strong>
                            <p>{t`+ Stripe processing fees`}</p>
                            <span>
                                <IconCheck size={16} aria-hidden="true" /> {t`No fixed fee per ticket`}
                            </span>
                        </div>
                    </div>
                    <div className={classes.paidNote}>
                        <IconCreditCard size={23} aria-hidden="true" />
                        <p>
                            <strong>{t`Paid events`}</strong>{' '}
                            {t`You choose: add the platform fee to the ticket price or absorb it. Stripe payment processing fees are separate.`}
                        </p>
                    </div>
                </section>

                <section className={classes.tools} aria-labelledby="tools-title">
                    <div className={classes.toolsIntro}>
                        <span className={classes.eyebrow}>{t`From the first click to the last guest`}</span>
                        <h2 id="tools-title">{t`Less admin. More good times.`}</h2>
                        <Button
                            component={Link}
                            to={startUrl}
                            className={classes.button}
                            rightSection={<IconArrowUpRight size={20} aria-hidden="true" />}
                        >{t`Create my event`}</Button>
                    </div>
                    <div className={classes.featureList}>
                        {features.map(({ icon: Icon, title, description }) => (
                            <article key={title}>
                                <Icon size={25} stroke={1.5} aria-hidden="true" />
                                <div>
                                    <h3>{title}</h3>
                                    <p>{description}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section id="comment" className={classes.how} aria-labelledby="how-title">
                    <div className={classes.sectionHeading}>
                        <span className={classes.eyebrow}>{t`How it works`}</span>
                        <h2 id="how-title">{t`An idea. A link. A crowd.`}</h2>
                    </div>
                    <div className={classes.steps}>
                        {steps.map((step, index) => (
                            <article key={step.title}>
                                <div className={classes.stepTop}>
                                    <span>0{index + 1}</span>
                                    <IconArrowRight size={25} aria-hidden="true" />
                                </div>
                                <h3>{step.title}</h3>
                                <p>{step.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section id="questions" className={classes.faq} aria-labelledby="faq-title">
                    <div>
                        <span className={classes.eyebrow}>{t`Good to know`}</span>
                        <h2 id="faq-title">{t`A few questions before we go?`}</h2>
                    </div>
                    <Accordion
                        value={openQuestion}
                        onChange={setOpenQuestion}
                        variant="default"
                        classNames={{ item: classes.faqItem, control: classes.faqControl, content: classes.faqContent }}
                    >
                        {faqs.map(({ question, answer }, index) => (
                            <Accordion.Item key={question} value={`question-${index}`}>
                                <Accordion.Control>{question}</Accordion.Control>
                                <Accordion.Panel>{answer}</Accordion.Panel>
                            </Accordion.Item>
                        ))}
                    </Accordion>
                </section>

                <section className={classes.finalCta} aria-labelledby="cta-title">
                    <span className={classes.sunDoodle} aria-hidden="true" />
                    <span className={classes.eyebrow}>{t`Go on. Bring them together.`}</span>
                    <h2 id="cta-title">{t`Your next “you had to be there” starts here.`}</h2>
                    <Button
                        component={Link}
                        to={startUrl}
                        size="lg"
                        className={classes.lightButton}
                        rightSection={<IconArrowUpRight size={22} aria-hidden="true" />}
                    >{t`Create my event`}</Button>
                    <span className={classes.finalNote}>{t`Free or paid. Always your event.`}</span>
                    <span className={classes.footerBrand} aria-hidden="true" />
                </section>
            </main>

            <footer className={classes.footer}>
                <Link to={`/${search}`} className={classes.wordmark} aria-label={BRAND_NAME}>
                    <img src="/images/dehors/dehors-icone.svg" width={31} height={36} alt="" />
                    <span className={classes.brandName} aria-hidden="true" />
                </Link>
                <p>{t`Quebec roots. People first.`}</p>
                <PoweredByFooter className={classes.poweredBy} />
            </footer>
        </div>
    );
};

export default Home;
