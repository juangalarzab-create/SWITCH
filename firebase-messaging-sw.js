/* =========================================================
 * SWITCH — Firebase Cloud Messaging Service Worker
 *
 * Este archivo DEBE llamarse exactamente "firebase-messaging-sw.js"
 * y DEBE estar en la raíz del sitio (mismo nivel que index.html).
 *
 * Recibe los mensajes PUSH cuando la app está:
 *   - Cerrada por completo
 *   - En segundo plano
 *   - Con la pantalla apagada / dispositivo en suspensión
 *
 * Para que funcione, alguien (Cloud Function o servidor) debe
 * enviar el push al endpoint FCM con el token del usuario.
 * ========================================================= */

// Usamos los SDKs "compat" porque los SW no soportan import módulos en todos
// los navegadores de forma fiable (sobre todo en Android viejo / iOS PWA).
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ⚠️ Estos valores DEBEN ser idénticos a los del index.html
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

/* ---------------------------------------------------------
 * Handler de mensajes en segundo plano.
 *
 * IMPORTANTE: si tu push trae una clave "notification" en el
 * payload, el navegador la muestra solo (no entra aquí). Para
 * controlar título, icono, sonido y click, mandamos siempre el
 * push como "data-only" desde la Cloud Function. Ahí entra acá:
 * --------------------------------------------------------- */
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Push recibido en segundo plano:', payload);

  const data = payload.data || {};
  const title = data.title || 'Nuevo mensaje en SWITCH';
  const body  = data.body  || 'Tienes un mensaje nuevo';
  const sala  = data.sala  || '';
  const tag   = data.tag   || ('switch-' + (sala || 'global'));

  const options = {
    body: body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: tag,                // Agrupa notificaciones de la misma sala
    renotify: true,          // Vibra/suena aunque ya haya una con el mismo tag
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      sala: sala,
      time: Date.now()
    },
    actions: [
      { action: 'open',  title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  return self.registration.showNotification(title, options);
});

/* ---------------------------------------------------------
 * Click en la notificación → abrir / enfocar la app
 * --------------------------------------------------------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((winList) => {
      // Si ya hay una ventana de la app abierta → enfocarla
      for (const client of winList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data });
          return client.focus();
        }
      }
      // Si no, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* ---------------------------------------------------------
 * Push "crudo" (por si llega sin pasar por onBackgroundMessage)
 * Esto es un fallback. Algunos navegadores entregan el push acá
 * antes de que FCM lo procese. Lo dejamos solo como red de seguridad.
 * --------------------------------------------------------- */
self.addEventListener('push', (event) => {
  // Si el SDK de FCM ya manejó el evento, no hacemos nada
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { data: { title: 'SWITCH', body: event.data.text() } };
  }

  // Si tiene "data" propio, ya lo gestionará onBackgroundMessage
  if (payload && payload.data && payload.data.handledBySdk) return;
});

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
