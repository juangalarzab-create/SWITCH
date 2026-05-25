/* =========================================================
 * SWITCH — Service Worker unificado
 * Maneja TANTO el caché offline (PWA) COMO las notificaciones
 * push de Firebase Cloud Messaging.
 *
 * Un solo SW evita conflictos de scope entre sw.js y
 * firebase-messaging-sw.js.
 * ========================================================= */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ── Firebase config (idéntico al index.html) ──
firebase.initializeApp({
  apiKey: "AIzaSyDbfWRBfbFwikuy9baL6RcbaT4v1KMU8lE",
  authDomain: "switch-46758.firebaseapp.com",
  databaseURL: "https://switch-46758-default-rtdb.firebaseio.com",
  projectId: "switch-46758",
  storageBucket: "switch-46758.firebasestorage.app",
  messagingSenderId: "338663681065",
  appId: "1:338663681065:web:4f5a0cdfd0d4178e3f4038"
});

const messaging = firebase.messaging();

// ── Caché PWA ──
const CACHE_NAME = 'switch-cache-v5';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('[SW] precache parcial:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // No interceptar Firebase, Telegram, CDNs externos
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cloudflare') ||
    url.hostname.includes('telegram') ||
    url.hostname.includes('cloudinary') ||
    url.hostname.includes('workers.dev')
  ) return;

  // Network-first para HTML, cache-first para assets
  if (req.destination === 'document') {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return res;
      }))
    );
  }
});

// ── Notificaciones push en segundo plano / app cerrada ──
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Push recibido en segundo plano:', payload);

  const data = payload.data || {};
  const title = data.title || 'Nuevo mensaje en SWITCH';
  const body  = data.body  || 'Tienes un mensaje nuevo';
  const sala  = data.sala  || '';
  const tag   = data.tag   || ('switch-' + (sala || 'global'));

  const options = {
    body,
    icon:               '/icons/icon-192.png',
    badge:              '/icons/badge-72.png',
    tag,
    renotify:           true,
    requireInteraction: false,
    vibrate:            [200, 100, 200],
    data: { url: data.url || '/', sala, time: Date.now() },
    actions: [
      { action: 'open',  title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  return self.registration.showNotification(title, options);
});

// ── Fallback: push crudo por si onBackgroundMessage no lo captura ──
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); } catch (e) {
    payload = { data: { title: 'SWITCH', body: event.data.text() } };
  }

  // Si ya tiene clave "notification", el navegador la muestra solo
  if (payload && payload.notification) return;

  const data  = (payload && payload.data) || {};
  const title = data.title || 'Mensaje nuevo en SWITCH';
  const body  = data.body  || 'Tienes un mensaje nuevo';
  const sala  = data.sala  || '';
  const tag   = data.tag   || ('switch-' + (sala || 'global'));

  const options = {
    body, tag,
    icon:    '/icons/icon-192.png',
    badge:   '/icons/badge-72.png',
    renotify: true,
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/', sala, time: Date.now() },
    actions: [
      { action: 'open',  title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Click en notificación → abrir / enfocar la app ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((winList) => {
      for (const client of winList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
