const CACHE = 'premium-pulse-offline-v2';
const APP_SHELL = ['/', '/index.html', '/shanta-life-logo.png', '/premium-pulse-app-icon.png', '/manifest.webmanifest'];
const EXTERNAL_ARTWORK = [
  'https://raw.githubusercontent.com/mriduultnd/PremiumPulse-SDPP-Redesign/main/Premium%20Pulse%20Laptop%20BG.jpg',
  'https://raw.githubusercontent.com/mriduultnd/PremiumPulse-SDPP-Redesign/main/Premium%20Pulse%20Mobile%20App%20BG.jpg'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('/index.html', { cache: 'reload' });
    if (!response.ok) throw new Error('Unable to cache PremiumPulse shell');
    const html = await response.clone().text();
    const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match => match[1]);
    await cache.put('/index.html', response.clone());
    await cache.put('/', response);
    await cache.addAll([...new Set([...APP_SHELL.slice(2), ...assets])]);
    await Promise.allSettled(EXTERNAL_ARTWORK.map(async url => {
      const artwork = await fetch(url, { mode: 'no-cors' });
      await cache.put(url, artwork);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('premium-pulse-offline-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const artwork = EXTERNAL_ARTWORK.includes(url.href);
  if (!sameOrigin && !artwork) return;
  if (request.mode === 'navigate' && sameOrigin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
