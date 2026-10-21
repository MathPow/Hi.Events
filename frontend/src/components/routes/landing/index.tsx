import {CSSProperties, ElementType, Fragment, ReactNode, RefObject, useCallback, useEffect, useId, useRef, useState} from "react";
import {NavLink} from "react-router";
import {t, Trans} from "@lingui/macro";
import {i18n} from "@lingui/core";
import {Helmet} from "react-helmet-async";
import {IconArrowDown, IconArrowRight, IconBrandInstagram, IconMinus, IconPlus} from "@tabler/icons-react";
import {useRoughEdge} from "../../../hooks/useRoughEdge.ts";
import {roughEdgeClipPath} from "../../../utilites/roughEdge.ts";
import {LanguageSwitcher} from "../../common/LanguageSwitcher";
import {dynamicActivateLocale} from "../../../locales.ts";
import {loadWordmarkLetters} from "./wordmarkLetters.ts";
import {Organizer, TrustedOrganizers} from "./TrustedOrganizers.tsx";
import {FeesComparator} from "./FeesComparator.tsx";
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
// Stripe's Canadian site, in French for the French page.
const stripeSite = (locale: string) => `https://stripe.com/${locale.startsWith('fr') ? 'fr-ca' : 'en-ca'}`;
const TRUSTED_ORGANIZERS: Organizer[] = [
    {name: 'DEHORS', logo: 'dehors', ratio: 1080 / 288, url: '/events/1/dehorsqc'},
    {name: 'Boréal Sports & Événements', logo: 'boreal', ratio: 1152 / 432, url: '/events/2/boreal-sports-evenements'},
    {name: "Su'l Pace", logo: 'sulpace', ratio: 1008 / 585.56, url: '/events/3/sul-pace'},
    {name: 'Course en Blanc', logo: 'course-en-blanc', ratio: 496 / 372, url: '/events/4/melysa-bolduc'},
    {name: 'Ultratales', logo: 'ultratales', ratio: 1008 / 360, url: '/events/1/dehorsqc'},
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

// Each file's size. A sticker is a WebP unless its name gives another extension.
const STICKER_SIZES: Record<string, [number, number]> = {
    'autocollant-drapeau-dehors': [288, 288],
    'autocollant-drapeau': [289, 288],
    'autocollant-sac-a-dos.svg': [144, 144],
    'autocollant-feu-de-camp.svg': [144, 144],
};

/**
 * A sticker that tilts from one pose to the other, like the "Ce qui nous guide"
 * stickers of the DEHORS shop (.sticker).
 */
const Sticker = ({name, className}: { name: string, className?: string }) => {
    const [width, height] = STICKER_SIZES[name] ?? [1, 1];

    return (
        <img className={`${classes.sticker} ${className ?? ''}`} src={`${ASSETS}/stickers/${name.includes('.') ? name : `${name}.webp`}`}
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

const sectionLinks = () => [
    {href: '#steps', label: t`How it works`},
    {href: '#fees', label: t`Fees`},
    {href: '#payments', label: t`Payments`},
    {href: '#features', label: t`Features`},
    {href: '#visibility', label: t({message: 'Visibility', context: 'landing section'})},
];

const MENU_ID = 'landing-menu';
// The landing's two languages, each named in itself.
const LANGUAGES = [{locale: 'fr', name: 'Français'}, {locale: 'en', name: 'English'}];

/** Like LanguageSwitcher: kept in the cookie, then the page reloads in it. */
const chooseLanguage = (locale: string) => {
    document.cookie = `locale=${locale};path=/;max-age=31536000`;
    dynamicActivateLocale(locale).finally(() => {
        window.location.href = window.location.pathname + window.location.search;
    });
};
// Wider than this, the sections' links are back in the bar.
const MENU_UP_TO = 1150;

/** The shop's menu button (EnteteSite.vue): two strokes that turn into a cross. */
const MenuButton = ({open, onToggle, buttonRef}: {
    open: boolean;
    onToggle: () => void;
    buttonRef?: RefObject<HTMLButtonElement>;
}) => (
    <button ref={buttonRef} type="button" className={classes.menuButton} aria-expanded={open} aria-controls={MENU_ID}
            aria-label={open ? t`Close the menu` : t`Open the menu`} onClick={onToggle}>
        <span className={classes.menuButtonStroke} aria-hidden="true"/>
        <span className={classes.menuButtonStroke} aria-hidden="true"/>
    </button>
);

/**
 * The shop's mobile menu (EnteteSite.vue), in the scrolled bar: the page's
 * sections, the account's two buttons and the language, then on phones
 * Instagram, the cream bar grown around them. Closing, it folds up instead of
 * vanishing.
 */
const MobileMenu = ({open, onClose}: { open: boolean, onClose: () => void }) => {
    const [rendered, setRendered] = useState(open);
    const nav = useRef<HTMLElement>(null);

    useEffect(() => {
        if (open) {
            setRendered(true);
            return;
        }
        const element = nav.current;
        if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setRendered(false);
            return;
        }
        const {height, marginTop} = getComputedStyle(element);
        element.style.overflow = 'clip';
        element.style.pointerEvents = 'none';
        const fold = element.animate(
            [{height, marginTop, opacity: 1}, {opacity: 0, offset: 0.25}, {height: '0px', marginTop: '0px', opacity: 0}],
            {duration: 450, easing: 'cubic-bezier(0.3, 0.8, 0.3, 1)'},
        );
        fold.onfinish = () => setRendered(false);

        return () => {
            fold.onfinish = null;
            fold.cancel();
        };
    }, [open]);

    // Its first link takes the focus, without a ring after a tap or a click.
    useEffect(() => {
        if (open && rendered) {
            nav.current?.querySelector('a')?.focus({focusVisible: false} as FocusOptions);
        }
    }, [open, rendered]);

    if (!rendered) {
        return null;
    }

    return (
        <nav ref={nav} id={MENU_ID} className={classes.menu} aria-label={t`Menu`}>
            {sectionLinks().map((link) => (
                <a key={link.href} href={link.href} onClick={(event) => {
                    onClose();
                    smoothScrollTo(event);
                }}><ShakyText text={link.label}/></a>
            ))}
            <div className={classes.menuActions}>
                <LandingButton as={NavLink} to="/auth/register" label={t`Create my account`} onClick={onClose}/>
                <LandingButton as={NavLink} to="/auth/login" variant="dark" label={t`Log in`} onClick={onClose}/>
            </div>
            <div className={classes.menuLanguages} role="group" aria-label={t`Language`}>
                {LANGUAGES.map(({locale, name}) => (
                    <button key={locale} type="button" lang={locale} aria-pressed={i18n.locale.startsWith(locale)}
                            onClick={() => chooseLanguage(locale)}>{name}</button>
                ))}
            </div>
            <a href={DEHORS_INSTAGRAM} className={classes.menuInstagram} target="_blank" rel="noopener">
                <IconBrandInstagram aria-hidden="true"/>
                <ShakyText text="@dehors.qc"/>
            </a>
        </nav>
    );
};

/**
 * The DEHORS shop's header, once the hero's own nav has scrolled away: a cream
 * pill fixed at the top of the screen with the mountain followed by the page's
 * sections, and the buttons. It comes down from above, and goes back up near
 * the top. On narrower screens it holds the menu, and comes down with it.
 */
const ScrolledNav = ({heroNav, menuOpen, onMenuToggle, onMenuClose}: {
    heroNav: RefObject<HTMLElement>;
    menuOpen: boolean;
    onMenuToggle: () => void;
    onMenuClose: () => void;
}) => {
    const [shown, setShown] = useState(false);
    const header = useRef<HTMLElement>(null);
    const menuButton = useRef<HTMLButtonElement>(null);

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

    // The menu closes on a press or a focus outside the bar, on Escape (back to
    // its button), and once the screen is wide enough for the links.
    useEffect(() => {
        if (!menuOpen) {
            return;
        }
        const outside = (event: Event) => {
            const target = event.target;
            if (target instanceof Element && !header.current?.contains(target)
                && !target.closest(`[aria-controls="${MENU_ID}"]`)) {
                onMenuClose();
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onMenuClose();
                menuButton.current?.focus();
            }
        };
        const resize = () => {
            if (window.innerWidth > MENU_UP_TO) {
                onMenuClose();
            }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', outside);
        window.addEventListener('keydown', escape);
        window.addEventListener('resize', resize);

        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', outside);
            window.removeEventListener('keydown', escape);
            window.removeEventListener('resize', resize);
        };
    }, [menuOpen, onMenuClose]);

    return (
        <header ref={header} className={`${classes.scrolledNav} ${shown || menuOpen ? classes.scrolledNavShown : ''} `
            + `${menuOpen ? classes.scrolledNavOpen : ''}`}>
            <a href="#top" className={classes.scrolledNavBrand} aria-label="Billetterie Dehors" onClick={(event) => {
                onMenuClose();
                smoothScrollTo(event);
            }}>
                <span aria-hidden="true"/>
            </a>
            <nav className={classes.scrolledNavLinks}>
                {sectionLinks().map((link) => (
                    <a key={link.href} href={link.href} onClick={smoothScrollTo}><ShakyText text={link.label}/></a>
                ))}
            </nav>
            <div className={classes.scrolledNavActions}>
                <NavLink to="/auth/login" className={classes.scrolledNavLogin}><ShakyText text={t`Log in`}/></NavLink>
                <RegisterButton/>
            </div>
            <MenuButton open={menuOpen} onToggle={onMenuToggle} buttonRef={menuButton}/>
            <MobileMenu open={menuOpen} onClose={onMenuClose}/>
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

// How far the backdrop slides each way: the 2rem it overflows by (.feesRock).
const BACKDROP_DRIFT = 32;

/**
 * A window onto a backdrop that stays put while its block scrolls past, and
 * drifts a little against the scroll: BACKDROP_DRIFT px down while the block
 * crosses the screen. The page's mask stops `background-attachment: fixed`
 * from doing the window, so the backdrop, as tall as the screen, is set back
 * at its top each frame. Under a finger the native scroll would run ahead of
 * it: there the backdrop only drifts inside its block.
 */
const WindowBackdrop = ({className}: { className: string }) => {
    const backdrop = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const element = backdrop.current;
        const frameElement = element?.parentElement;
        if (!element || !frameElement) {
            return;
        }
        const fixed = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const drifts = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!fixed && !drifts) {
            return;
        }
        let frame: number | null = null;
        let visible = false;
        const place = () => {
            frame = null;
            const box = frameElement.getBoundingClientRect();
            const half = window.innerHeight / 2;
            // From 1 as the block enters at the bottom to -1 as it leaves at the top.
            const progress = Math.min(Math.max((box.top + box.height / 2 - half) / (half + box.height / 2), -1), 1);
            const drift = drifts ? -progress * BACKDROP_DRIFT : 0;
            element.style.setProperty('--backdrop-y', `${((fixed ? -box.top : 0) + drift).toFixed(2)}px`);
        };
        const schedule = () => {
            if (visible && frame === null) {
                frame = requestAnimationFrame(place);
            }
        };
        // Lenis just moved the page: follow in the same frame.
        const placeNow = () => {
            if (visible) {
                place();
            }
        };
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? false;
            schedule();
        });
        observer.observe(frameElement);
        element.setAttribute(fixed ? 'data-fixed' : 'data-drift', '');
        const stopFollowingLenis = onSmoothScroll(placeNow);
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('resize', schedule, {passive: true});

        return () => {
            observer.disconnect();
            stopFollowingLenis();
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
        };
    }, []);

    return (
        <span className={className} aria-hidden="true">
            <span ref={backdrop}/>
        </span>
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
 * The feature list's height with every answer closed, on the picture beside it
 * (--closed-height): the picture matches the closed list and keeps its size
 * while an answer opens.
 */
const useClosedListHeight = (list: RefObject<HTMLUListElement>, aside: RefObject<HTMLElement>) => {
    useEffect(() => {
        const element = list.current;
        const target = aside.current;
        if (!element || !target) {
            return;
        }
        const measure = () => {
            const items = [...element.children];
            const gap = parseFloat(getComputedStyle(element).rowGap) || 0;
            const height = items.reduce((total, item) => {
                const answer = item.querySelector(`.${classes.featureAnswer}`);
                return total + item.getBoundingClientRect().height - (answer?.getBoundingClientRect().height ?? 0);
            }, gap * Math.max(items.length - 1, 0));
            target.style.setProperty('--closed-height', `${height.toFixed(2)}px`);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(element);

        return () => observer.disconnect();
    }, [list, aside]);
};

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

/**
 * The steps as cards in the shop's colours, each tilted its own way, the
 * second and fourth set lower: a staircase to climb. A card straightens under
 * the mouse; one with somewhere to go is a link.
 */
const StepCards = ({steps}: { steps: { title: string, text: string, to?: string }[] }) => (
    <ol className={classes.stepCards}>
        {steps.map((step, index) => {
            const content = (
                <>
                    <span className={classes.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                    <IconArrowRight className={classes.stepArrow} size={22} stroke={1.8}/>
                </>
            );

            return (
                <li key={step.title} className={`${classes.stepCard} ${classes[`stepCard${index + 1}`]}`} data-rise>
                    {step.to ? (
                        <Rough as={NavLink} to={step.to} amplitude={1.8} step={36} className={classes.stepCardBody}>
                            {content}
                        </Rough>
                    ) : (
                        <Rough amplitude={1.8} step={36} className={classes.stepCardBody}>{content}</Rough>
                    )}
                </li>
            );
        })}
    </ol>
);

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
    const [menuOpen, setMenuOpen] = useState(false);
    const toggleMenu = useCallback(() => setMenuOpen((open) => !open), []);
    const closeMenu = useCallback(() => setMenuOpen(false), []);

    const steps = [
        {title: t`Create your free account`, text: t`A few minutes and your ticketing is ready.`, to: '/auth/register'},
        {title: t`Add your colours`, text: t`Your logo, your colours: ticketing that looks like your brand.`},
        {title: t`Connect your Stripe`, text: t`Payments go straight to your account.`},
        {title: t`Gather your people`, text: t`Put your tickets on sale, share the link and scan at the door.`},
    ];

    const features = [
        {title: t`Free or paid, one link`, text: t`Each event gets a page to share anywhere: free or paid tickets, bought in a few clicks.`, picture: 'features/groupe-crete'},
        {title: t`Simple, in your colours`, text: t`A dashboard that's easy to pick up, and ticketing that looks like your brand.`, picture: 'features/groupe-drapeau'},
        {title: t`Your participants, from ticket to door`, text: t`An up-to-date list, emails to keep them posted, and ticket scanning on the day.`, picture: 'features/file-sentier'},
        {title: t`Sell your merch`, text: t`Sell your merch with the tickets, handed over at the event.`, picture: 'features/autocollants', contain: true},
        {
            title: t`On the DEHORS calendar`,
            text: <Trans>Your event shows up in the <a href={`${DEHORS_SITE}/calendrier`} target="_blank" rel="noopener"><ShakyText
                text={t`DEHORS calendar`}/></a>, the one the community checks to plan its outings.</Trans>,
            picture: 'features/coucher-soleil',
        },
    ].map(({picture, contain, ...feature}) => ({...feature, picture: {src: `${ASSETS}/${picture}.webp`, contain}}));
    const missingPicture: FeaturePicture = {src: `${ASSETS}/features/foret-ruisseau.webp`};
    const featurePictures = [FEATURES_PICTURE, ...features.map((feature) => feature.picture), missingPicture];
    // One feature open at a time; the picture beside the list is its own, the section's when none is.
    const [openFeature, setOpenFeature] = useState(0);
    const featureList = useRef<HTMLUListElement>(null);
    const featuresAside = useRef<HTMLDivElement>(null);
    useClosedListHeight(featureList, featuresAside);
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

            <ScrolledNav heroNav={heroNav} menuOpen={menuOpen} onMenuToggle={toggleMenu} onMenuClose={closeMenu}/>

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
                                <MenuButton open={menuOpen} onToggle={toggleMenu}/>
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
                    <h2 className={classes.introTitle} data-rise><Trans>Made by organizers,<br/>for organizers.</Trans></h2>
                    <div className={classes.introText} data-rise>
                        <p>{t`Billetterie Dehors is the online ticketing platform for local races, outings and competitions. Small fees, the money straight into your account, and your event shown to our whole community.`}</p>
                        <LandingButton as="a" href="#steps" onClick={smoothScrollTo} variant="dark"
                                       label={t`How it works`}/>
                    </div>
                    <div className={classes.introPhotoSmall} data-rise>
                        <Photo name="photo-a"/>
                    </div>
                    <div className={classes.introPhotoMedium} data-rise>
                        <Photo name="photo-b"/>
                    </div>
                    <div className={classes.introPhotoLarge} data-rise>
                        <Photo name="photo-c"/>
                        <Sticker name="autocollant-sac-a-dos.svg" className={classes.stickerBackpack}/>
                    </div>
                </section>

                <section className={classes.trust}>
                    <div data-rise>
                        <h2>{t`Local organizers already trust us`}</h2>
                    </div>
                    <TrustedOrganizers organizers={TRUSTED_ORGANIZERS}/>
                </section>

                <section id="steps" className={classes.steps}>
                    <div className={classes.sectionHead} data-rise>
                        <h2>{t`Your ticketing in 4 steps`}</h2>
                    </div>
                    <StepCards steps={steps}/>
                </section>

                <section id="fees" className={classes.feesWrap}>
                    <Rough className={classes.fees} amplitude={2} step={52} data-rise>
                        <WindowBackdrop className={classes.feesRock}/>
                        <div className={classes.feesText}>
                            <h2>{t`Fees that stay small.`}</h2>
                            <p>{t`2.5% per ticket, plus Stripe's payment fees. No subscription, no hidden fees, and no fees at all if your event is free.`}</p>
                            <RegisterButton variant="dark"/>
                        </div>
                        <div className={classes.feesCardWrap}>
                            <Rough className={classes.feesCard} amplitude={1.8} step={36}>
                                <FeesComparator/>
                            </Rough>
                            <Sticker name="autocollant-feu-de-camp.svg" className={classes.stickerCampfire}/>
                            <p className={classes.feesNote}>{t`Billetterie Dehors: 2.5% + Stripe 2.9% + $0.30. Eventbrite in Canada, according to its help centre (October 2026): 3.5% + $1.29 per ticket + 2.9% processing. One ticket per order, fees included in the price.`}</p>
                        </div>
                    </Rough>
                </section>

                <section id="payments" className={classes.stripe} data-stack>
                    <div className={classes.stripeText} data-rise>
                        <h2>{t`Stripe, what's that?`}</h2>
                        <p>{t`Stripe is the company that takes the card payments for your ticketing. It's the same tool you can use for your next digital projects: millions of businesses already do.`}</p>
                        <LandingButton as="a" href={stripeSite(i18n.locale)} target="_blank" rel="noopener" variant="dark"
                                       label={t`Learn more about Stripe`}/>
                    </div>
                    <div className={classes.stripeCardWrap} data-rise>
                        <div className={classes.stripeCardStack}>
                            <Rough className={classes.stripeCardUnder} amplitude={1.2} step={40}>
                                <div className={classes.stripeCardUnderFoot}>
                                    <span>{t`Get paid from the presale.`}</span>
                                    <span className={classes.stripeCardUnderMark} aria-hidden="true"/>
                                </div>
                            </Rough>
                            <Rough className={classes.stripeCard} amplitude={1.2} step={40}>
                                <h3>{t`Your account, your money.`}</h3>
                                <span className={classes.stripeChip} aria-hidden="true"/>
                                <div className={classes.stripeCardBottom}>
                                    <span>{t`Free to open, no subscription`}</span>
                                    <span className={classes.stripeLogo} role="img" aria-label="Stripe"/>
                                </div>
                            </Rough>
                        </div>
                    </div>
                </section>

                {/* The last sections share one orange mountain, which slides over the stopped one before it. */}
                <div className={classes.mountain}>
                    <section id="features" className={classes.featuresWrap}>
                        <div className={classes.features} data-rise>
                            <h2>{t`Everything you need`}</h2>
                            <div className={classes.featuresLayout}>
                                <ul ref={featureList}>
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
                                <div ref={featuresAside} className={classes.featuresAside}>
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

                </div>
            </main>

            <footer className={classes.footer}>
                <Rough className={classes.footerCard} amplitude={2} step={56}>
                    <div className={classes.footerInner}>
                        <div className={classes.footerCta}>
                            <h2>{t`Ready to gather your people?`}</h2>
                            <p>{t`A small Quebec team, ready to help you launch your first event.`}</p>
                            <div className={classes.footerCtaActions}>
                                <RegisterButton/>
                                <LandingButton as="a" href={`mailto:${CONTACT_EMAIL}`} variant="ghost"
                                               label={t`Write to us`}/>
                            </div>
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
                    <div className={classes.footerLegal}>
                        <span>© {new Date().getFullYear()} Billetterie Dehors</span>
                        <span>{t`Made in Québec, for people on the move.`}</span>
                    </div>
                    <FooterWordmark/>
                </Rough>
            </footer>
        </div>
    );
};

export default Landing;
