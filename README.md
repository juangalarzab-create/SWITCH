# SWITCH — Chat App en Tiempo Real con Notificaciones Push

Chat grupal con Firebase Realtime Database + Telegram Bot + **notificaciones push** que funcionan en app abierta, segundo plano, cerrada o pantalla apagada.

---

## 📁 Estructura

```
switch-app-firebase/
├── index.html                  # App web (CSS + HTML + JS, en un archivo)
├── manifest.json               # PWA manifest
├── sw.js                       # Service Worker general (caché offline)
├── firebase-messaging-sw.js    # Service Worker FCM (push en background)
├── icons/                      # Iconos PWA
├── worker/                     # ⭐ Cloudflare Worker GRATIS (sin tarjeta)
│   ├── src/worker.js
│   ├── wrangler.toml
│   ├── package.json
│   └── README.md               # ← Instrucciones del Worker
├── functions/                  # Cloud Function (alternativa, requiere Blaze)
├── firebase.json
├── database.rules.json
├── .firebaserc
├── .gitignore
└── README.md
```

---

## 🎯 Dos caminos para tener push

### 🟢 Camino A — Cloudflare Workers (GRATIS, sin tarjeta) ← TÚ VAS POR ACÁ

- Plan Spark de Firebase (gratis)
- Cloudflare Workers (100k req/día gratis, **sin tarjeta**)
- FCM HTTP V1 funciona en Spark, solo hace falta un "servidor" que llame a la API

📖 Instrucciones detalladas del Worker en **[`worker/README.md`](worker/README.md)**.

### 🔵 Camino B — Cloud Functions (requiere Blaze, pide tarjeta)

Ya está listo en `functions/`. Si algún día migras a Blaze, solo haz `firebase deploy --only functions` y no necesitas el Worker.

---

## 🚀 GUÍA COMPLETA — Camino A (gratis con Cloudflare)

### 1️⃣ Firebase Console

#### A. VAPID key (Web Push certificate)

1. https://console.firebase.google.com/ → tu proyecto `switch-46758`
2. ⚙️ **Project settings → Cloud Messaging**
3. **Web configuration → Web Push certificates → Generate key pair**
4. Copia la clave (87 caracteres, empieza con `B`)
5. En `index.html`, reemplaza:
   ```js
   const VAPID_KEY = "REEMPLAZA_CON_TU_VAPID_KEY_DEL_FIREBASE_CONSOLE";
   ```
   por tu clave real.

#### B. Sobre "API de Cloud Messaging (heredada) — Inhabilitado"

Eso es **normal**. Es la API legacy que Google apagó en julio 2024. Lo que vamos a usar es **FCM HTTP V1**, que se autentica con Service Account. **No hay que activar nada en esa página**, viene activo por defecto en proyectos nuevos.

#### C. Generar Service Account JSON

1. Firebase Console → ⚙️ **Project settings → Service accounts**
2. Click **"Generate new private key"** → **Generate key**
3. Te descarga un archivo `switch-46758-firebase-adminsdk-XXXXX.json`
4. **GUÁRDALO SEGURO**. Es la "llave maestra" de tu Firebase. **NO lo subas a GitHub.**

#### D. Reglas de la Realtime Database

Firebase Console → **Realtime Database → Rules**, pega:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
**Publish**.

> ⚠️ Reglas abiertas (modo dev). Para producción endurece con auth.

---

### 2️⃣ Cloudflare Worker

Sigue **[`worker/README.md`](worker/README.md)** para el detalle. Resumen:

1. Cuenta gratis en https://dash.cloudflare.com/sign-up (sin tarjeta)
2. Instala Wrangler: `npm install -g wrangler`
3. `wrangler login`
4. `cd worker && npm install && wrangler deploy`
5. Te imprime tu URL: `https://switch-push.TU-USUARIO.workers.dev` — cópiala
6. Sube el secreto: `wrangler secret put SERVICE_ACCOUNT_JSON` (pega el JSON del paso 1.C)
7. `wrangler deploy` otra vez (para que tome el secreto)
8. Verifica abriendo la URL en el navegador — debe decir "SWITCH push worker — alive"

Pega esa URL en `index.html`:

```js
const WORKER_URL = "https://switch-push.TU-USUARIO.workers.dev";
```
**Sin `/` al final.**

---

### 3️⃣ GitHub — Subir el cliente

#### ✅ Qué subir
- `index.html`, `manifest.json`, `sw.js`, `firebase-messaging-sw.js`
- Carpeta `icons/`
- Carpeta `worker/` (sin `node_modules`, ya está en `.gitignore`)
- Carpeta `functions/` (opcional, sin `node_modules`)
- `firebase.json`, `database.rules.json`, `.firebaserc`, `.gitignore`, `README.md`

#### ❌ NUNCA subir
- `serviceAccount*.json` (la llave del paso 1.C)
- `node_modules/`
- archivos `.env`

*(el `.gitignore` ya bloquea los peligrosos)*

#### Opción A — Por la web (sin terminal)

1. https://github.com/new → ej. `switch-chat`
2. NO inicialices con README
3. **"uploading an existing file"** → arrastra todo
4. Commit
5. **Settings → Pages → Branch: `main`, Folder: `/ (root)` → Save**
6. Tu app: `https://TU-USUARIO.github.io/switch-chat/`

#### Opción B — Por terminal

```bash
cd switch-app-firebase
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/switch-chat.git
git push -u origin main
```
Activa Pages en **Settings → Pages**.

#### 🔒 Endurecer CORS del Worker (cuando ya tengas tu URL pública)

Edita `worker/wrangler.toml`:
```toml
ALLOWED_ORIGIN = "https://TU-USUARIO.github.io"
```
Y `cd worker && wrangler deploy`.

---

## 🧪 Cómo probar

### Test 1 — App abierta
1. Abre la app en Chrome/Edge → acepta el permiso de notificaciones.
2. Entra a una sala con tu nombre.
3. En otra ventana entra a la **misma** sala con otro nombre.
4. Envía un mensaje desde la segunda.
5. ✅ Banner azul + sonido en la primera.

### Test 2 — App en segundo plano
1. Minimiza la pestaña del primer usuario.
2. Envía mensaje desde el segundo.
3. ✅ Notificación del sistema (fuera del navegador).

### Test 3 — App cerrada ← el verdadero test
1. Cierra completamente la pestaña del primero (o instala la PWA y ciérrala).
2. Envía mensaje desde el segundo.
3. ✅ Llega notificación al sistema (FCM + Worker en acción).

### Debug si falla
- Logs del Worker en tiempo real: `cd worker && wrangler tail`, luego manda un mensaje
- Chrome DevTools → **Application → Service Workers** (ver si están activos)
- Abre directo `https://TU-USUARIO.github.io/REPO/firebase-messaging-sw.js` (no debe ser 404)
- Consola del navegador (F12) en la pestaña con la app — busca errores `[FCM]` o `[Push]`

---

## 📱 Instalar como PWA

- **Android (Chrome)**: ⋮ → **Instalar app**
- **iOS (Safari 16.4+)**: Compartir → **Añadir a pantalla de inicio**
   ⚠️ En iOS las push **solo funcionan** dentro de la PWA instalada.
- **Desktop (Chrome/Edge)**: icono ⊕ en la barra de URL → **Instalar**

---

## 🔧 Stack técnico

- **Firebase Realtime Database** → salas, mensajes, tokens FCM
- **Firebase Cloud Messaging V1** → push multiplataforma
- **Cloudflare Workers** → "servidor" gratis que dispara los push
- **Telegram Bot** → almacenamiento de imágenes y audios
- **PWA** → manifest, service workers, instalable
- **HTML/CSS/JS vanilla** → sin frameworks ni build

---

## 🛠 Funcionalidades

- ✅ Salas y chat en tiempo real
- ✅ Imágenes (vía Telegram) y audios
- ✅ Panel Admin (`admin` / `1212`)
- ✅ Mini-juegos (TicTacToe, Stop, Quiz)
- ✅ Responsivo (móvil/tablet/desktop/landscape, safe areas)
- ✅ PWA instalable
- ✅ Notificaciones push foreground/background/cerrada

---

## 🐛 Troubleshooting

| Problema | Solución |
|---|---|
| `No se obtuvo token` en consola | VAPID_KEY mal copiado, o no aceptaste el permiso, o estás en incógnito |
| Worker responde "alive" pero no llegan push | Mira `wrangler tail` mientras mandas un mensaje. Suele ser SERVICE_ACCOUNT_JSON mal subido |
| `firebase-messaging-sw.js 404` | Tiene que estar en la raíz publicada. Abre la URL directa en el navegador. |
| iOS no recibe push | Solo funciona si **instalas la PWA**. Requiere iOS 16.4+. |
| Permiso "denegado" siempre | Configuración del navegador → permisos del sitio → reset |

---

## 💰 Costo real

Todo gratis si te quedas dentro de los free tiers:

- **Firebase Spark**: gratis siempre
- **FCM**: gratis siempre (Google no cobra por push)
- **Cloudflare Workers**: 100,000 requests/día gratis. Un chat normal gasta <1,000/día.
- **GitHub Pages**: gratis para repos públicos (y privados con Pro)

**No te pide tarjeta en ningún paso.**
