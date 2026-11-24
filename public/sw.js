// A network-only navigation fallback keeps private content out of offline storage.
self.addEventListener('fetch', (event) => {
  if (
    event.request.mode !== 'navigate' ||
    !event.request.url.startsWith(self.registration.scope)
  )
    return
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Yotei · Hors connexion</title><style>body{font:1rem system-ui;background:#141518;color:white;margin:3rem 1.5rem}a{color:#cfbfff}</style><h1>Yotei</h1><p>Reconnecte-toi à Internet pour retrouver ton cercle.</p><a href="./">Réessayer</a></html>',
          {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        ),
    ),
  )
})
