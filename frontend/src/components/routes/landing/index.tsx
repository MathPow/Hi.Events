import {CSSProperties, ElementType, Fragment, ReactNode, RefObject, useCallback, useEffect, useId, useRef, useState} from "react";
import {NavLink} from "react-router";
import {t, Trans} from "@lingui/macro";
import {Helmet} from "react-helmet-async";
import {IconArrowDown, IconArrowRight, IconMinus, IconPlus} from "@tabler/icons-react";
import {useRoughEdge} from "../../../hooks/useRoughEdge.ts";
import {roughEdgeClipPath} from "../../../utilites/roughEdge.ts";
import {LanguageSwitcher} from "../../common/LanguageSwitcher";
import {loadWordmarkLetters} from "./wordmarkLetters.ts";
import {Organizer, TrustedOrganizers} from "./TrustedOrganizers.tsx";
import {HeroTitle} from "./HeroTitle.tsx";
import {LandingButton, ShakyText} from "./LandingButton.tsx";
import {useRoughButton} from "./roughButton.ts";
import {Opening} from "./Opening.tsx";
import {glideTo, installSmoothScroll, onSmoothScroll} from "./smoothScroll.ts";
import {useMatchWidth} from "./useMatchWidth.ts";
import {useStackOnScroll} from "./useStackOnScroll.ts";
import classes from "./Landing.module.scss";

const ASSETS = '/landing';
const HERO_VIDEO = `${ASSETS}/hero.mp4`;
const CONTACT_EMAIL = 'support@dehorsqc.com';
const DEHORS_SITE = 'https://dehorsqc.com';
const DEHORS_INSTAGRAM = 'https://www.instagram.com/dehors.qc';
const TRUSTED_ORGANIZERS: Organizer[] = [
    {name: 'DEHORS', logo: 'dehors', ratio: 1080 / 288},
    {name: 'Boréal Sports & Événements', logo: 'boreal', ratio: 1152 / 432},
    {name: "Su'l Pace", logo: 'sulpace', ratio: 1008 / 585.56},
    {name: 'Course en Blanc', logo: 'course-en-blanc', ratio: 496 / 372},
    {name: 'Ultratales', logo: 'ultratales', ratio: 1008 / 360},
];

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
    'autocollant-drapeau-dehors': [288, 288],
    'autocollant-drapeau': [289, 288],
    'autocollant-perfectly-round': [289, 289],
    'autocollant-perfect-stick': [361, 144],
};

/**
 * A sticker that tilts from one pose to the other, like the "Ce qui nous guide"
 * stickers of the DEHORS shop (.sticker).
 */
const Sticker = ({name, className}: { name: string, className?: string }) => {
    const [width, height] = STICKER_SIZES[name] ?? [1, 1];

    return (
        <img className={`${classes.sticker} ${className ?? ''}`} src={`${ASSETS}/stickers/${name}.webp`}
             width={width} height={height} alt="" aria-hidden="true" loading="lazy" decoding="async"
             draggable={false}/>
    );
};

const Photo = ({name, className}: { name: string, className?: string }) => (
    <Rough className={`${classes.photo} ${className ?? ''}`} amplitude={2.2} step={34}>
        <img src={`${ASSETS}/photos/${name}.webp`} alt="" loading="lazy" decoding="async"/>
    </Rough>
);

/**
 * The round arrow under the hero, cut by hand like the shop's buttons: its
 * fill and its cream ring boil and it hops on hover. The wrapper places it and
 * plays the entrance, so neither fights the hop for `translate`.
 */
const ScrollDown = () => {
    const rough = useRoughButton<HTMLAnchorElement>({round: true});

    return (
        <span className={classes.scrollDownWrap}>
            <a ref={rough} href="#intro" className={classes.scrollDown} aria-label={t`Scroll down`}
               onClick={smoothScrollTo}>
                <IconArrowDown size={24} stroke={2.4}/>
            </a>
        </span>
    );
};

const RegisterButton = ({variant = 'orange'}: { variant?: 'orange' | 'dark' }) => (
    <LandingButton as={NavLink} to="/auth/register" variant={variant} label={t`Create my account`}/>
);

/**
 * The DEHORS shop's header, once the hero's own nav has scrolled away: a cream
 * pill fixed at the top of the screen with the mountain followed by the page's
 * sections, and the buttons. It comes down from above, and goes back up near
 * the top.
 */
const ScrolledNav = ({heroNav}: { heroNav: RefObject<HTMLElement> }) => {
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const nav = heroNav.current;
        if (!nav) {
            return;
        }
        let frame: number | null = null;
        // Where the nav sits in the layout, whatever its entrance or the opening's clip do to it on screen.
        const update = () => {
            frame = null;
            let top = 0;
            for (let element: HTMLElement | null = nav; element; element = element.offsetParent as HTMLElement | null) {
                top += element.offsetTop;
            }
            setShown(window.scrollY > top + nav.offsetHeight);
        };
        const schedule = () => {
            if (frame === null) {
                frame = requestAnimationFrame(update);
            }
        };

        update();
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('resize', schedule, {passive: true});

        return () => {
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
        };
    }, [heroNav]);

    return (
        <header className={`${classes.scrolledNav} ${shown ? classes.scrolledNavShown : ''}`}>
            <a href="#top" className={classes.scrolledNavBrand} aria-label="Billetterie Dehors" onClick={smoothScrollTo}>
                <span aria-hidden="true"/>
            </a>
            <nav className={classes.scrolledNavLinks}>
                {[
                    {href: '#steps', label: t`How it works`},
                    {href: '#fees', label: t`Fees`},
                    {href: '#payments', label: t`Payments`},
                    {href: '#features', label: t`Features`},
                    {href: '#visibility', label: t({message: 'Visibility', context: 'landing section'})},
                ].map((link) => (
                    <a key={link.href} href={link.href} onClick={smoothScrollTo}><ShakyText text={link.label}/></a>
                ))}
            </nav>
            <div className={classes.scrolledNavActions}>
                <NavLink to="/auth/login" className={classes.scrolledNavLogin}><ShakyText text={t`Log in`}/></NavLink>
                <RegisterButton/>
            </div>
        </header>
    );
};

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Where an element sits in the page, from the layout: a section held in the
 * stack (useStackOnScroll) or a block still rising is drawn elsewhere on screen.
 */
const layoutTop = (element: HTMLElement) => {
    let top = 0;
    for (let current: HTMLElement | null = element; current; current = current.offsetParent as HTMLElement | null) {
        top += current.offsetTop;
    }
    return top;
};

/** Glides to the anchor's target with an eased scroll instead of the browser's jump. */
const smoothScrollTo = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.querySelector<HTMLElement>(event.currentTarget.hash);
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    event.preventDefault();
    // Clear of the scrolled nav, which will be over the top of the screen there.
    const nav = document.querySelector<HTMLElement>(`.${classes.scrolledNav}`);
    const top = layoutTop(target) - (nav ? nav.offsetTop + nav.offsetHeight + 16 : 32);

    if (glideTo(top)) {
        return;
    }

    const start = window.scrollY;
    const distance = top - start;
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

// Offset on entering, as a share of the screen height and at most RISE_MAX px.
const RISE = 0.14;
const RISE_MAX = 140;
// Share of the screen, from the bottom, a block crosses before being in place.
const RISE_ZONE = 0.4;

/**
 * Blocks arrive from below as the page scrolls, like on the DEHORS shop: when
 * one enters at the bottom of the screen it sits a little lower than its place,
 * then rises faster than the page, less and less, and settles once it has
 * crossed the bottom of the screen. Scrolling back up, it goes down again.
 * Nothing fades, only the block moves (`--rise`, given to `translate`).
 */
const useRiseOnScroll = (root: RefObject<HTMLElement>) => {
    useEffect(() => {
        const blocks = [...root.current?.querySelectorAll<HTMLElement>('[data-rise]') ?? []];
        if (!blocks.length) {
            return;
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const offsets = new Map(blocks.map((block) => [block, 0]));
        let frame: number | null = null;

        const follow = () => {
            frame = null;
            const view = window.innerHeight;
            const rise = reducedMotion.matches ? 0 : Math.min(view * RISE, RISE_MAX);
            const zone = view * RISE_ZONE;
            // All the reads, then all the writes: a single layout.
            const tops = blocks.map((block) => block.getBoundingClientRect().top - (offsets.get(block) ?? 0));

            blocks.forEach((block, index) => {
                const done = Math.min(Math.max((view - tops[index]) / zone, 0), 1);
                // The rest of the way, cubed: fast on entering, gentle at the end.
                const offset = Math.round(rise * (1 - done) ** 3 * 100) / 100;
                if (offset === offsets.get(block)) {
                    return;
                }
                offsets.set(block, offset);
                if (offset) {
                    block.style.setProperty('--rise', `0 ${offset.toFixed(2)}px`);
                } else {
                    block.style.removeProperty('--rise');
                }
            });
        };
        const schedule = () => {
            if (frame === null) {
                frame = requestAnimationFrame(follow);
            }
        };
        // Lenis just moved the page: follow in the same frame.
        const followNow = () => {
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
            follow();
        };

        follow();
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('resize', schedule, {passive: true});
        reducedMotion.addEventListener('change', schedule);
        const stopFollowingLenis = onSmoothScroll(followNow);

        return () => {
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            reducedMotion.removeEventListener('change', schedule);
            stopFollowingLenis();
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
        };
    }, [root]);
};

const LANGUAGE_LIST_SEED = 0x5eed;

/** Cuts the open language list like the DEHORS shop's menus; Mantine renders it in a portal. */
const cutLanguageList = () => requestAnimationFrame(() => {
    const list = document.querySelector<HTMLElement>(`.${classes.languageOptions}`);
    if (!list?.offsetWidth) {
        return;
    }
    const radius = parseFloat(getComputedStyle(list).borderTopLeftRadius) || 0;
    list.style.clipPath = roughEdgeClipPath(list.offsetWidth, list.offsetHeight,
        {radius, step: 40, amplitude: 1.5, seed: LANGUAGE_LIST_SEED});
});

const HeroVideo = () => {
    const video = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            video.current?.pause();
        }
    }, []);

    return (
        <video ref={video} className={classes.heroVideo} autoPlay muted loop playsInline preload="metadata"
               poster={`${ASSETS}/photos/hero-groupe.webp`} aria-hidden="true">
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

// Pictures of the features, framed like the photos of the shop's collage.
// `contain` shows the whole of a cut-out picture, on peach.
interface FeaturePicture {
    src: string;
    contain?: boolean;
}

const FEATURES_PICTURE: FeaturePicture = {src: `${ASSETS}/features/groupe-sommet.webp`};
// The frame turns a little each time its picture changes, one way then the other.
const FRAME_ANGLES = [-3, 2.5, -2, 3, -2.5, 2, -1.5];

/** A picture in the cream frame of the shop's collage photos, cut by hand. */
const FeatureFrame = ({pictures, shown, className}: {
    pictures: FeaturePicture[];
    shown: number;
    className?: string;
}) => (
    <Rough className={`${classes.featureFrame} ${className ?? ''}`} amplitude={2.2} step={34} aria-hidden="true"
           style={{'--angle': `${FRAME_ANGLES[shown % FRAME_ANGLES.length]}deg`} as CSSProperties}>
        <div className={classes.featureFrameInner}>
            {pictures.map((picture, index) => (
                <img key={picture.src} src={picture.src} alt="" loading="lazy" decoding="async" draggable={false}
                     className={`${classes.featurePicture} ${picture.contain ? classes.featurePictureContain : ''} ${index === shown ? classes.featurePictureShown : ''}`}/>
            ))}
        </div>
    </Rough>
);

/**
 * A feature as a question of the DEHORS shop's FAQ: the whole line is a button
 * that opens the answer below it, one at a time (the section keeps which one
 * is open). Closed, the answer is `visibility: hidden`,
 * neither read nor reachable by keyboard, but still there for its height to
 * slide on opening as on closing. On narrow screens, where the section's
 * picture has no room beside the list, the answer shows it.
 */
const Feature = ({title, badge, darkBadge, picture, open, onToggle, children}: {
    title: string;
    badge: string;
    darkBadge?: boolean;
    picture: FeaturePicture;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
}) => {
    const id = useId();

    return (
        <Rough as="li" className={open ? classes.featureOpen : undefined}>
            <h3 className={classes.featureTitle}>
                <button id={`${id}button`} type="button" className={classes.featureButton} aria-expanded={open}
                        aria-controls={`${id}answer`} onClick={onToggle}>
                    <span className={classes.featureName}>{title}</span>
                    <Rough as="span" amplitude={1} step={14}
                           className={`${classes.badge} ${darkBadge ? classes.badgeDark : ''}`}>{badge}</Rough>
                    <span className={classes.featurePastille} aria-hidden="true">
                        <IconPlus className={classes.featurePlus} size={16} stroke={2.5}/>
                        <IconMinus className={classes.featureMinus} size={16} stroke={2.5}/>
                    </span>
                </button>
            </h3>
            <div id={`${id}answer`} className={classes.featureAnswer} role="region" aria-labelledby={`${id}button`}>
                <div className={classes.featureFold}>
                    <p className={classes.featureText}>{children}</p>
                    <FeatureFrame pictures={[picture]} shown={0} className={classes.featureFrameInline}/>
                </div>
            </div>
        </Rough>
    );
};

// Between the words, but never inside the number ("2 200+").
const WORD_BREAK = / (?=\D)/;

/**
 * The first time the block comes on screen, its `.revealItem`s rise one after
 * the other (data-reveal). Already on screen at load, or under reduced motion,
 * it stays as it is.
 */
const useRevealOnShow = (root: RefObject<HTMLElement>) => {
    useEffect(() => {
        const element = root.current;
        if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches
            || element.getBoundingClientRect().top < window.innerHeight) {
            return;
        }

        element.dataset.reveal = 'waiting';
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                element.dataset.reveal = 'shown';
                observer.disconnect();
            }
        }, {rootMargin: '0px 0px -20% 0px'});
        observer.observe(element);

        return () => {
            observer.disconnect();
            delete element.dataset.reveal;
        };
    }, [root]);
};

/**
 * The orange tagline spans exactly the width of the big number above it. On
 * show, the words of the number rise, then the tagline, then the text.
 */
const CommunityHeading = () => {
    const root = useRef<HTMLDivElement>(null);
    const title = useRef<HTMLHeadingElement>(null);
    const tagline = useRef<HTMLSpanElement>(null);
    useMatchWidth(title, tagline);
    useRevealOnShow(root);
    const words = t`2,200+ athletes`.split(WORD_BREAK);
    const order = (index: number) => ({'--order': index} as CSSProperties);

    return (
        <div ref={root} data-rise>
            <h2 ref={title}>
                {words.map((word, index) => (
                    <Fragment key={index}>
                        {index > 0 && ' '}
                        <span className={`${classes.communityWord} ${classes.revealItem}`} style={order(index)}>
                            {word}
                        </span>
                    </Fragment>
                ))}
            </h2>
            <p className={`${classes.communityTagline} ${classes.revealItem}`} style={order(words.length)}>
                <span ref={tagline}>{t`will see your event`}</span>
            </p>
            <p className={classes.revealItem} style={order(words.length + 1)}>
                {t`We share the ticketing platform's events on Dehors's social media. Your event goes straight in front of a community of people on the move.`}
            </p>
        </div>
    );
};

const Landing = () => {
    const root = useRef<HTMLDivElement>(null);
    // The stack first: the blocks rise from where the sections are held.
    useStackOnScroll(root);
    useRiseOnScroll(root);
    // The opening plays on a first load only: the server rendered it. Arriving
    // from another page of the app, the hero's entrance plays right away.
    const [opening, setOpening] = useState(() => typeof document === 'undefined'
        || document.querySelector('[data-landing-opening]') !== null);
    const [entrance, setEntrance] = useState(!opening);
    const startEntrance = useCallback(() => setEntrance(true), []);
    const endOpening = useCallback(() => setOpening(false), []);

    // Under the orange screen the wheel does nothing: smoothing starts after it.
    useEffect(() => opening ? undefined : installSmoothScroll(), [opening]);

    const heroNav = useRef<HTMLElement>(null);

    const steps = [
        {title: t`Create your account`, text: t`A few minutes and your ticketing is ready.`},
        {title: t`Add your colours`, text: t`Your logo, your colours: ticketing that looks like your brand.`},
        {title: t`Connect Stripe`, text: t`Payments go straight to your account.`},
        {title: t`Gather your people`, text: t`Put your tickets on sale, share the link and scan at the door.`},
    ];

    const features = [
        {title: t`Free or paid`, text: t`All events are welcome, whatever the price.`, picture: 'groupe-crete'},
        {title: t`Scan at the door`, text: t`Validate tickets in a blink on event day.`, picture: 'file-sentier'},
        {title: t`Sell your merch`, text: t`Sell your merch with the tickets, handed over at the event.`, picture: 'autocollants', contain: true},
        {title: t`Your colours`, text: t`Ticketing that looks like your brand, not ours.`, picture: 'groupe-drapeau'},
        {title: t`Attendee list`, text: t`Keep track of your people, from the first ticket to check-in.`, picture: 'montee-foret'},
    ].map(({picture, contain, ...feature}) => ({...feature, picture: {src: `${ASSETS}/features/${picture}.webp`, contain}}));
    const missingPicture: FeaturePicture = {src: `${ASSETS}/features/foret-ruisseau.webp`};
    const featurePictures = [FEATURES_PICTURE, ...features.map((feature) => feature.picture), missingPicture];
    // One feature open at a time; the picture beside the list is its own, the section's when none is.
    const [openFeature, setOpenFeature] = useState(0);
    const featureProps = (index: number) => ({
        open: openFeature === index,
        onToggle: () => setOpenFeature((open) => open === index ? 0 : index),
    });

    return (
        <div ref={root} className={classes.landing} data-entrance={entrance ? '' : undefined}>
            <Helmet>
                <title>{t`Billetterie Dehors · Fewer fees, more people`}</title>
                <meta name="description"
                      content={t`The Quebec ticketing platform built for the sports community.`}/>
            </Helmet>

            {opening && <Opening onReveal={startEntrance} onDone={endOpening}/>}

            <ScrolledNav heroNav={heroNav}/>

            <main className={classes.page}>
                <section id="top" className={classes.heroWrap}>
                    <Rough className={classes.hero} amplitude={2} step={56}>
                        <HeroVideo/>
                        <div className={classes.heroShade}/>
                        <header ref={heroNav} className={classes.nav}>
                            <NavLink to="/" className={classes.brand}>Billetterie<br/>Dehors</NavLink>
                            <div className={classes.navActions}>
                                <LanguageSwitcher iconColor="currentColor" locales={['fr', 'en']} classNames={{
                                    root: classes.language,
                                    input: classes.languageInput,
                                    section: classes.languageSection,
                                    dropdown: classes.languageDropdown,
                                    options: classes.languageOptions,
                                    option: classes.languageOption,
                                }} comboboxProps={{width: 'max-content', position: 'bottom-end', offset: 8}}
                                                  checkIconPosition="right" onDropdownOpen={cutLanguageList}/>
                                <LandingButton as={NavLink} to="/auth/login" variant="ghost" label={t`Log in`}/>
                                <RegisterButton/>
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
                    <ScrollDown/>
                </section>

                <section id="intro" className={classes.intro}>
                    <div className={classes.introText} data-rise>
                        <p>{t`Billetterie Dehors is the local ticketing platform for races, outings and competitions. A small local team, fees that stay small, and a community of athletes that grows every week.`}</p>
                        <LandingButton as="a" href="#steps" onClick={smoothScrollTo} variant="dark"
                                       label={t`How it works`}/>
                    </div>
                    <h2 className={classes.introTitle} data-rise>
                        <span>{t`Free or paid.`}</span>
                        <span>{t`Small or big.`}</span>
                        <span>{t`Everyone is welcome.`}</span>
                    </h2>
                    <div className={classes.introPhotos} data-rise>
                        <Photo name="photo-a" className={classes.introPhotoSmall}/>
                        <Photo name="photo-b" className={classes.introPhotoMedium}/>
                        <div className={classes.introPhotoLargeWrap}>
                            <Photo name="photo-c" className={classes.introPhotoLarge}/>
                            <Sticker name="autocollant-perfectly-round" className={classes.stickerRound}/>
                        </div>
                    </div>
                </section>

                <section id="steps" className={classes.steps}>
                    <div className={classes.sectionHead} data-rise>
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
                            <li key={step.title} className={`${classes.stepCard} ${classes[`stepCard${index + 1}`]}`}
                                data-rise>
                                <Rough amplitude={1.8} step={36} className={classes.stepCardBody}>
                                    <span className={classes.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
                                    <h3>{step.title}</h3>
                                    <p>{step.text}</p>
                                    <IconArrowRight className={classes.stepArrow} size={18}/>
                                </Rough>
                                {/* Pinned at the middle of its top edge, outside the card's rough clip. */}
                                <svg className={classes.stepPin} viewBox="0 0 36 36" aria-hidden="true"
                                     focusable="false">
                                    <circle cx="18" cy="18" r="14"/>
                                    <circle className={classes.stepPinShine} cx="13.5" cy="13" r="4"/>
                                </svg>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className={classes.trust}>
                    <div data-rise>
                        <h2>{t`Local organizers already trust us`}</h2>
                    </div>
                    <TrustedOrganizers organizers={TRUSTED_ORGANIZERS}/>
                </section>

                <section id="fees" className={classes.feesWrap}>
                    <Rough className={classes.fees} amplitude={2} step={52} data-rise>
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

                <section id="payments" className={classes.stripe} data-stack>
                    <div className={classes.stripeText} data-rise>
                        <h2>{t`Stripe, what's that?`}</h2>
                        <p>{t`Stripe is the online payment system used by millions of businesses. Your participants pay by card, and the money goes straight to your Stripe account, not ours.`}</p>
                        <RegisterButton variant="dark"/>
                    </div>
                    <div className={classes.stripeCardWrap} data-rise>
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

                {/* The last sections share one orange mountain, which slides over the stopped one before it. */}
                <div className={classes.mountain}>
                    <section id="features" className={classes.featuresWrap}>
                        <div className={classes.features} data-rise>
                            <h2>{t`Everything you need`}</h2>
                            <div className={classes.featuresLayout}>
                                <ul>
                                    {features.map((feature, index) => (
                                        <Feature key={feature.title} title={feature.title} badge={t`Included`}
                                                 picture={feature.picture} {...featureProps(index + 1)}>
                                            {feature.text}
                                        </Feature>
                                    ))}
                                    <Feature title={t`Missing something?`} badge={t`On request`} darkBadge
                                             picture={missingPicture} {...featureProps(features.length + 1)}>
                                        <Trans>Small local team: write to us on <a href={DEHORS_INSTAGRAM} target="_blank"
                                            rel="noopener"><ShakyText text="Instagram"/></a> or at <a
                                            href={`mailto:${CONTACT_EMAIL}`}><ShakyText text={CONTACT_EMAIL}/></a>, we
                                            move fast and we listen.</Trans>
                                    </Feature>
                                </ul>
                                <div className={classes.featuresAside}>
                                    <FeatureFrame pictures={featurePictures} shown={openFeature}/>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="visibility" className={classes.community}>
                        <CommunityHeading/>
                        <div className={classes.communityPhotos} data-rise>
                            <Photo name="photo-b" className={classes.communityPhoto1}/>
                            <Photo name="photo-c" className={classes.communityPhoto2}/>
                            <Photo name="photo-a" className={classes.communityPhoto3}/>
                            <Sticker name="autocollant-drapeau" className={classes.stickerCommunityLeft}/>
                            <Sticker name="autocollant-drapeau-dehors" className={classes.stickerCommunityRight}/>
                        </div>
                    </section>

                    <section className={classes.ctaWrap}>
                        <Rough className={classes.cta} amplitude={2} step={52} data-rise>
                            <div className={classes.ctaText}>
                                <h2>{t`Ready to gather your people?`}</h2>
                                <p>{t`A small Quebec team, ready to help you launch your first event. Missing a feature? We'll add it with you.`}</p>
                            </div>
                            <div className={classes.ctaActions}>
                                <RegisterButton/>
                                <LandingButton as="a" href={`mailto:${CONTACT_EMAIL}`} variant="ghost"
                                               label={t`Write to us`}/>
                            </div>
                        </Rough>
                    </section>
                </div>
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
                            <a href="#steps" onClick={smoothScrollTo}><ShakyText text={t`How it works`}/></a>
                            <a href="#fees" onClick={smoothScrollTo}><ShakyText text={t`Fees`}/></a>
                            <NavLink to="/auth/login"><ShakyText text={t`Log in`}/></NavLink>
                        </div>
                        <div>
                            <span className={classes.eyebrow}>Dehors</span>
                            <a href={DEHORS_SITE}><ShakyText text={t`The club`}/></a>
                            <a href={`${DEHORS_SITE}/calendrier`}><ShakyText text={t`Outings calendar`}/></a>
                            <a href={DEHORS_INSTAGRAM} target="_blank" rel="noopener"><ShakyText text="Instagram"/></a>
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
