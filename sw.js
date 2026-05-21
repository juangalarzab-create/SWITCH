/* =========================================================
 * SWITCH PWA — Service Worker general
 * Caché offline básico + control del ciclo de vida del SW.
 *
 * NOTA: Las notificaciones PUSH se manejan en
 * firebase-messaging-sw.js (NO en este archivo).
 * ========================================================= */

const CACHE_NAME = 'switch-cache-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

// Instalación: precarga assets básicos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('[SW] precache parcial:', err))
  );
  self.skipWaiting();
});

// Activación: limpia cachés viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: estrategia "network-first" para HTML, "cache-first" para assets estáticos
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo GET
  if (req.method !== 'GET') return;

  // No interceptamos llamadas a Firebase, Telegram ni CDNs externos.
  const url = new URL(req.url);
  const isExternal =
    url.origin !== self.location.origin ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('telegram.org') ||
    url.hostname.includes('cloudflare.com');
  if (isExternal) return;

  // HTML: network-first
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Assets estáticos: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

// Cuando el usuario hace click en una notificación, este SW también recibe el evento
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Si ya hay una ventana abierta, enfocarla
      for (const win of wins) {
        if ('focus' in win) return win.focus();
      }
      // Si no, abrir una nueva
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
