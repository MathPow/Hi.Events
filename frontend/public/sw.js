// Back-office service worker, registered with the /manage/ scope. It makes the app installable and
// shows a page when the network drops; it caches nothing, so every deploy is live on the next load.

const offlinePage = () => {
    const french = (self.navigator.language || '').toLowerCase().startsWith('fr');
    const title = french ? 'Pas de connexion' : 'No connection';
    const text = french
        ? 'Vérifiez votre connexion internet, puis réessayez.'
        : 'Check your internet connection, then try again.';
    const retry = french ? 'Réessayer' : 'Try again';

    return `<!doctype html>
<html lang="${french ? 'fr' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#fff7e9">
<title>${title}</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff7e9;color:#352924;font-family:system-ui,-apple-system,sans-serif;text-align:center}
main{padding:2rem 1.5rem;max-width:22rem}
h1{margin:0 0 .5rem;font-size:1.5rem}
p{margin:0 0 1.5rem;line-height:1.5;color:rgb(53 41 36 / .7)}
button{border:0;border-radius:999px;padding:.875rem 1.75rem;background:#fa7853;color:#fff;font:inherit;font-weight:700}
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${text}</p>
<button onclick="location.reload()">${retry}</button>
</main>
</body>
</html>`;
};

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    if (event.request.mode !== 'navigate') {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => new Response(offlinePage(), {
            headers: {'Content-Type': 'text/html; charset=utf-8'},
        })),
    );
});
