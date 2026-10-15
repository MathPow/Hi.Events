import {CSSProperties, ElementType, ReactNode, useEffect, useRef, useState} from "react";
import {NavLink} from "react-router";
import {t} from "@lingui/macro";
import {Helmet} from "react-helmet-async";
import {IconArrowDown, IconArrowRight} from "@tabler/icons-react";
import {useRoughEdge} from "../../../hooks/useRoughEdge.ts";
import {LanguageSwitcher} from "../../common/LanguageSwitcher";
import {loadWordmarkLetters} from "./wordmarkLetters.ts";
import {TrustedOrganizers} from "./TrustedOrganizers.tsx";
import {HeroTitle} from "./HeroTitle.tsx";
import {LandingButton} from "./LandingButton.tsx";
import {useMatchWidth} from "./useMatchWidth.ts";
import classes from "./Landing.module.scss";

const ASSETS = '/landing';
const HERO_VIDEO = `${ASSETS}/hero.mp4`;
const CONTACT_EMAIL = 'billets@dehorsqc.com';
const DEHORS_SITE = 'https://dehorsqc.com';
const DEHORS_INSTAGRAM = 'https://www.instagram.com/dehors.qc';
const TRUSTED_ORGANIZERS = ['DEHORS', 'Boréal', "Su'l Pace"];

const Rough = <T extends ElementType = 'div'>({as, amplitude, step, className, children, ...props}: {
    as?: T;
    amplitude?: number;
    step?: number;
    className?: string;
    children?: ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>) => {
    const Component = as ?? 'div';
    const ref = useRoughEdge<HTMLElement>({amplitude, step});

    return <Component ref={ref} className={className} {...props}>{children}</Component>;
};

const STICKER_SIZES: Record<string, [number, number]> = {
    'autocollant-appareil-photo': [289, 289],
    'autocollant-boing': [289, 216],
    'autocollant-crocs': [361, 216],
    'autocollant-drapeau-dehors': [288, 288],
    'autocollant-drapeau': [289, 288],
    'autocollant-perfectly-round': [289, 289],
    'autocollant-perfect-stick': [361, 144],
    'autocollant-sapin': [217, 288],
};

/**
 * A sticker cut in two along its diagonal: the bottom-left half stays flat,
 * the top-right half is a flap that peels up and lays back down on hover
 * (the "Ce qui nous guide" stickers of the DEHORS shop, faster).
 */
const Sticker = ({name, className}: { name: string, className?: string }) => {
    const src = `${ASSETS}/stickers/${name}.webp`;
    const [width, height] = STICKER_SIZES[name] ?? [1, 1];

    return (
        <span className={`${classes.sticker} ${className ?? ''}`} aria-hidden="true"
              style={{'--w': width, '--h': height, '--image': `url('${src}')`} as CSSProperties}>
            <img className={classes.stickerFlat} src={src} alt="" loading="lazy" decoding="async"/>
            <span className={classes.stickerFlap}>
                <img className={classes.stickerFront} src={src} alt="" loading="lazy" decoding="async"/>
                <span className={classes.stickerBack}/>
            </span>
        </span>
    );
};

const Photo = ({name, className}: { name: string, className?: string }) => (
    <Rough className={`${classes.photo} ${className ?? ''}`} amplitude={2.2} step={34}>
        <img src={`${ASSETS}/photos/${name}.webp`} alt="" loading="lazy" decoding="async"/>
    </Rough>
);

const RegisterButton = ({variant = 'orange'}: { variant?: 'orange' | 'dark' }) => (
    <LandingButton as={NavLink} to="/auth/register" variant={variant} label={t`Create my account`}/>
);

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Glides to the anchor's target with an eased scroll instead of the browser's jump. */
const smoothScrollTo = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.querySelector(event.currentTarget.hash);
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    event.preventDefault();

    const start = window.scrollY;
    const distance = target.getBoundingClientRect().top - 32;
    const duration = Math.min(1400, Math.max(700, Math.abs(distance) * 0.9));
    const startedAt = performance.now();

    const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        window.scrollTo(0, start + distance * easeInOutCubic(progress));
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };
    requestAnimationFrame(step);
};

/** Fades sections in as they enter the viewport. Content stays visible without JS. */
const useRevealOnScroll = () => {
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const items = root.current?.querySelectorAll<HTMLElement>('[data-reveal]');
        if (!items?.length || typeof IntersectionObserver === 'undefined'
            || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.filter((entry) => entry.isIntersecting).forEach((entry, index) => {
                const item = entry.target as HTMLElement;
                item.style.setProperty('--reveal-delay', `${index * 0.14}s`);
                item.setAttribute('data-reveal', 'shown');
                observer.unobserve(item);
            });
        }, {rootMargin: '0px 0px -10% 0px'});

        items.forEach((item) => {
            item.setAttribute('data-reveal', 'waiting');
            observer.observe(item);
        });

        return () => observer.disconnect();
    }, []);

    return root;
};

const HeroVideo = () => {
    const video = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            video.current?.pause();
        }
    }, []);

    return (
        <video ref={video} className={classes.heroVideo} autoPlay muted loop playsInline preload="metadata"
               poster={`${ASSETS}/photos/hero-poster.webp`} aria-hidden="true">
            <source src={HERO_VIDEO} type="video/mp4"/>
        </video>
    );
};

/** The DEHORS wordmark at the bottom of the footer: its letters rise one by one once uncovered. */
const FooterWordmark = () => {
    const [letters, setLetters] = useState('');
    const [visible, setVisible] = useState(false);
    const wordmark = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        loadWordmarkLetters(`${ASSETS}/dehors-mot-sable.svg`).then(setLetters).catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!letters || !wordmark.current) {
            return;
        }

        const element = wordmark.current;
        const check = () => {
            const box = element.getBoundingClientRect();
            const page = element.closest('footer')?.previousElementSibling?.getBoundingClientRect();
            const top = Math.max(box.top, page?.bottom ?? -Infinity);
            const bottom = Math.min(box.bottom, window.innerHeight);
            if (box.height && (bottom - top) / box.height >= 0.3) {
                setVisible(true);
                window.removeEventListener('scroll', check);
                window.removeEventListener('resize', check);
            }
        };

        window.addEventListener('scroll', check, {passive: true});
        window.addEventListener('resize', check);
        check();

        return () => {
            window.removeEventListener('scroll', check);
            window.removeEventListener('resize', check);
        };
    }, [letters]);

    if (!letters) {
        return <img className={classes.footerWordmark} src={`${ASSETS}/dehors-mot-sable.svg`} width="1400"
                    height="277" alt="DEHORS" loading="lazy" decoding="async"/>;
    }

    return <div ref={wordmark} role="img" aria-label="DEHORS"
                className={`${classes.footerWordmark} ${classes.footerWordmarkLetters} ${visible ? classes.footerWordmarkVisible : ''}`}
                dangerouslySetInnerHTML={{__html: letters}}/>;
};

/** The orange tagline spans exactly the width of the big number above it. */
const CommunityHeading = () => {
    const title = useRef<HTMLHeadingElement>(null);
    const tagline = useRef<HTMLSpanElement>(null);
    useMatchWidth(title, tagline);

    return (
        <div data-reveal>
            <h2 ref={title}>{t`2,200+ athletes`}</h2>
            <p className={classes.communityTagline}><span ref={tagline}>{t`will see your event`}</span></p>
            <p>{t`We share the ticketing platform's events on Dehors's social media. Your event goes straight in front of a community of people on the move.`}</p>
        </div>
    );
};

const Landing = () => {
    const root = useRevealOnScroll();

    const steps = [
        {title: t`Create your account`, text: t`A few minutes and your ticketing is ready.`},
        {title: t`Add your colours`, text: t`Your logo, your colours: ticketing that looks like your brand.`},
        {title: t`Connect Stripe`, text: t`Payments go straight to your account.`},
        {title: t`Gather your people`, text: t`Put your tickets on sale, share the link and scan at the door.`},
    ];

    const features = [
        {title: t`Free or paid`, text: t`All events are welcome, whatever the price.`},
        {title: t`Scan at the door`, text: t`Validate tickets in a blink on event day.`},
        {title: t`Sell your merch`, text: t`Sell your merch with the tickets, handed over at the event.`},
        {title: t`Your colours`, text: t`Ticketing that looks like your brand, not ours.`},
        {title: t`Attendee list`, text: t`Keep track of your people, from the first ticket to check-in.`},
    ];

    return (
        <div ref={root} className={classes.landing}>
            <Helmet>
                <title>{t`Billetterie Dehors · Fewer fees, more people`}</title>
                <meta name="description"
                      content={t`The Quebec ticketing platform built for the sports community.`}/>
            </Helmet>

            <main className={classes.page}>
                <section className={classes.heroWrap}>
                    <Rough className={classes.hero} amplitude={2} step={56}>
                        <HeroVideo/>
                        <div className={classes.heroShade}/>
                        <header className={classes.nav}>
                            <NavLink to="/" className={classes.brand}>Billetterie<br/>Dehors</NavLink>
                            <div className={classes.navActions}>
                                <LanguageSwitcher iconColor="currentColor" locales={['fr', 'en']} classNames={{
                                    root: classes.language,
                                    input: classes.languageInput,
                                    section: classes.languageSection,
                                    dropdown: classes.languageDropdown,
                                    option: classes.languageOption,
                                }} comboboxProps={{width: 'max-content', position: 'bottom-end', offset: 8}}/>
                                <RegisterButton/>
                                <LandingButton as={NavLink} to="/auth/login" variant="ghost" label={t`Log in`}/>
                            </div>
                        </header>
                        <div className={classes.heroContent}>
                            <HeroTitle/>
                        </div>
                        <div className={classes.heroFooter}>
                            <span>{t`2,200+ athletes`}</span>
                            <span>{t`2.5% + Stripe fees`}</span>
                        </div>
                    </Rough>
                    <Sticker name="autocollant-appareil-photo" className={classes.stickerCamera}/>
                    <Sticker name="autocollant-drapeau" className={classes.stickerFlagLeft}/>
                    <Sticker name="autocollant-drapeau-dehors" className={classes.stickerFlagRight}/>
                    <Sticker name="autocollant-crocs" className={classes.stickerCrocs}/>
                    <Sticker name="autocollant-boing" className={classes.stickerBoing}/>
                    <Sticker name="autocollant-sapin" className={classes.stickerTree}/>
                    <a href="#intro" className={classes.scrollDown} aria-label={t`Scroll down`} onClick={smoothScrollTo}>
                        <IconArrowDown size={24} stroke={2.4}/>
                    </a>
                </section>

                <section id="intro" className={classes.intro}>
                    <div className={classes.introText} data-reveal>
                        <p>{t`Billetterie Dehors is the local ticketing platform for races, outings and competitions. A small local team, fees that stay small, and a community of athletes that grows every week.`}</p>
                        <LandingButton as="a" href="#steps" onClick={smoothScrollTo} variant="dark"
                                       label={t`How it works`}/>
                    </div>
                    <h2 className={classes.introTitle} data-reveal>
                        <span>{t`Free or paid.`}</span>
                        <span>{t`Small or big.`}</span>
                        <span>{t`Everyone is welcome.`}</span>
                    </h2>
                    <div className={classes.introPhotos} data-reveal>
                        <Photo name="photo-a" className={classes.introPhotoSmall}/>
                        <Photo name="photo-b" className={classes.introPhotoMedium}/>
                        <div className={classes.introPhotoLargeWrap}>
                            <Photo name="photo-c" className={classes.introPhotoLarge}/>
                            <Sticker name="autocollant-perfectly-round" className={classes.stickerRound}/>
                        </div>
                    </div>
                </section>

                <section id="steps" className={classes.steps}>
                    <div className={classes.sectionHead} data-reveal>
                        <div>
                            <h2>{t`Your ticketing in 4 steps`}</h2>
                        </div>
                        <div className={classes.sectionHeadAside}>
                            <p>{t`From creating your account to scanning at the door, everything takes a few minutes. One step at a time.`}</p>
                            <RegisterButton variant="dark"/>
                        </div>
                    </div>
                    <ol className={classes.stepCards}>
                        {steps.map((step, index) => (
                            <Rough as="li" key={step.title} amplitude={1.8} step={36} data-reveal
                                   className={`${classes.stepCard} ${classes[`stepCard${index + 1}`]}`}>
                                <span className={classes.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
                                <h3>{step.title}</h3>
                                <p>{step.text}</p>
                                <IconArrowRight className={classes.stepArrow} size={18}/>
                            </Rough>
                        ))}
                    </ol>
                </section>

                <section className={classes.trust}>
                    <div data-reveal>
                        <h2>{t`Local organizers already trust us`}</h2>
                    </div>
                    <TrustedOrganizers names={TRUSTED_ORGANIZERS}/>
                </section>

                <section id="fees" className={classes.feesWrap}>
                    <Rough className={classes.fees} amplitude={2} step={52} data-reveal>
                        <div className={classes.feesText}>
                            <h2>{t`Fees that stay small.`}</h2>
                            <p>{t`No subscription, no hidden fees. Build the fees into your ticket price: the participants cover them.`}</p>
                            <RegisterButton/>
                        </div>
                        <div className={classes.feesCardWrap}>
                            <Rough className={classes.feesCard} amplitude={1.8} step={36}>
                                <span className={classes.eyebrow}>{t`Per ticket sold`}</span>
                                <dl>
                                    <div>
                                        <dt>Billetterie Dehors</dt>
                                        <dd>{t`2.5%`}</dd>
                                    </div>
                                    <div>
                                        <dt>{t`Stripe (payment)`}</dt>
                                        <dd>{t`2.9% + $0.30`}</dd>
                                    </div>
                                </dl>
                                <strong className={classes.feesTotal}>{t`That's it.`}</strong>
                                <span className={classes.feesFree}>{t`Free event? No fees.`}</span>
                            </Rough>
                            <Sticker name="autocollant-perfect-stick" className={classes.stickerStick}/>
                        </div>
                    </Rough>
                </section>

                <section className={classes.stripe}>
                    <div className={classes.stripeText} data-reveal>
                        <h2>{t`Stripe, what's that?`}</h2>
                        <p>{t`Stripe is the online payment system used by millions of businesses. Your participants pay by card, and the money goes straight to your Stripe account, not ours.`}</p>
                        <RegisterButton variant="dark"/>
                    </div>
                    <div className={classes.stripeCardWrap} data-reveal>
                        <Rough className={classes.stripeCard} amplitude={1.8} step={36}>
                            <div className={classes.stripeCardTop}>
                                <h3>{t`Your money, before the big day.`}</h3>
                                <p>{t`With the big players, the money often stays locked until the event. Here, it's paid out on Stripe's schedule.`}</p>
                            </div>
                            <div className={classes.stripeCardBottom}>
                                <span>{t`Paid out on Stripe's schedule`}</span>
                                <span>{t`Not locked until the event`}</span>
                                <strong>{t`Invest in your event right now`}<IconArrowRight size={18}/></strong>
                            </div>
                        </Rough>
                        <Sticker name="autocollant-perfectly-round" className={classes.stickerStripe}/>
                    </div>
                </section>

                <section className={classes.featuresWrap}>
                    <Rough className={classes.features} amplitude={2} step={52} data-reveal>
                        <h2>{t`Everything you need`}</h2>
                        <ul>
                            {features.map((feature) => (
                                <li key={feature.title}>
                                    <strong>{feature.title}</strong>
                                    <Rough as="span" amplitude={1} step={14} className={classes.badge}>{t`Included`}</Rough>
                                    <span>{feature.text}</span>
                                    <IconArrowRight size={18}/>
                                </li>
                            ))}
                            <li>
                                <strong>{t`Missing something?`}</strong>
                                <Rough as="span" amplitude={1} step={14}
                                       className={`${classes.badge} ${classes.badgeDark}`}>{t`On request`}</Rough>
                                <span>{t`Small local team: write to us, we move fast and we listen.`}</span>
                                <a href={`mailto:${CONTACT_EMAIL}`} aria-label={t`Write to us`}><IconArrowRight size={18}/></a>
                            </li>
                        </ul>
                    </Rough>
                </section>

                <section className={classes.community}>
                    <CommunityHeading/>
                    <div className={classes.communityPhotos} data-reveal>
                        <Photo name="photo-b" className={classes.communityPhoto1}/>
                        <Photo name="photo-c" className={classes.communityPhoto2}/>
                        <Photo name="photo-a" className={classes.communityPhoto3}/>
                        <Sticker name="autocollant-drapeau" className={classes.stickerCommunityLeft}/>
                        <Sticker name="autocollant-drapeau-dehors" className={classes.stickerCommunityRight}/>
                    </div>
                </section>

                <section className={classes.ctaWrap}>
                    <Rough className={classes.cta} amplitude={2} step={52} data-reveal>
                        <h2>{t`Ready to gather your people?`}</h2>
                        <div className={classes.ctaRow}>
                            <p>{t`A small Quebec team, ready to help you launch your first event. Missing a feature? We'll add it with you.`}</p>
                            <RegisterButton/>
                        </div>
                    </Rough>
                    <Sticker name="autocollant-appareil-photo" className={classes.stickerCta}/>
                </section>
            </main>

            <footer className={classes.footer}>
                <div className={classes.footerInner}>
                    <div className={classes.footerBrand}>
                        <strong>Billetterie Dehors</strong>
                        <span>{t`Made in Québec, for people on the move.`}</span>
                    </div>
                    <nav className={classes.footerLinks} aria-label={t`Footer`}>
                        <div>
                            <span className={classes.eyebrow}>{t`Ticketing`}</span>
                            <a href="#steps" onClick={smoothScrollTo}>{t`How it works`}</a>
                            <a href="#fees" onClick={smoothScrollTo}>{t`Fees`}</a>
                            <NavLink to="/auth/login">{t`Log in`}</NavLink>
                        </div>
                        <div>
                            <span className={classes.eyebrow}>Dehors</span>
                            <a href={DEHORS_SITE}>{t`The club`}</a>
                            <a href={`${DEHORS_SITE}/calendrier`}>{t`Outings calendar`}</a>
                            <a href={DEHORS_INSTAGRAM} target="_blank" rel="noopener">Instagram</a>
                        </div>
                    </nav>
                </div>
                <div className={classes.footerLegal}>© {new Date().getFullYear()} Billetterie Dehors</div>
                <FooterWordmark/>
            </footer>
        </div>
    );
};

export default Landing;
