import {hydrateRoot} from "react-dom/client";
import {createBrowserRouter, matchRoutes, RouterProvider} from "react-router-dom";

import {router} from "./router";
import {App} from "./App";
import {queryClient} from "./utilites/queryClient";
import {dynamicActivateLocale, getClientLocale, getSupportedLocale,} from "./locales.ts";
import {captureInstallPrompt} from "./utilites/installPrompt.ts";

declare global {
    interface Window {
        __REHYDRATED_STATE__?: unknown;
    }
}

const dehydratedState = window.__REHYDRATED_STATE__;

// Pendant un déploiement, un fichier /assets peut répondre une erreur que Cloudflare puis le
// navigateur gardent des heures: la page reste blanche. On redemande alors ces fichiers en
// sautant le cache (ce qui remplace la mauvaise copie), puis on recharge la page. Une fois par
// minute au plus, pour ne pas boucler si le serveur est vraiment en panne.
const ASSETS_RELOAD_KEY = 'dehors-rechargement-fichiers';

window.addEventListener('vite:preloadError', (event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    const files = String((payload as Error)?.message ?? payload).match(/\/assets\/[\w.-]+/g) ?? [];

    try {
        const last = Number(sessionStorage.getItem(ASSETS_RELOAD_KEY));
        if (Date.now() - last < 60_000) {
            return;
        }
        sessionStorage.setItem(ASSETS_RELOAD_KEY, String(Date.now()));
    } catch {
        return;
    }

    event.preventDefault();
    Promise.all(files.map((file) => fetch(file, {cache: 'reload'}).catch(() => null)))
        .finally(() => window.location.reload());
});

async function initClientApp() {
    captureInstallPrompt();

    const rawLocale = getClientLocale();
    const locale = getSupportedLocale(rawLocale);
    await dynamicActivateLocale(locale);

    // Resolve lazy-loaded routes before hydration
    const matches = matchRoutes(router, window.location)?.filter((m) => m.route.lazy);
    if (matches && matches.length > 0) {
        await Promise.all(
            matches.map(async (m) => {
                const routeModule = await m.route.lazy?.();
                Object.assign(m.route, {...routeModule, lazy: undefined});
            })
        );
    }

    const browserRouter = createBrowserRouter(router);

    hydrateRoot(
        document.getElementById("app") as HTMLElement,
        <App queryClient={queryClient} locale={rawLocale} dehydratedState={dehydratedState}>
            <RouterProvider router={browserRouter}/>
        </App>
    );
}

initClientApp();
