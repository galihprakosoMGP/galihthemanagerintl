/* Service worker: makes the app work offline (cache-first).
   IMPORTANT: bump CACHE_VERSION every time you change any file, or users keep the old version. */
const CACHE_VERSION = 'the-manager-v5';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/i18n.js', 'js/flags.js', 'js/config.js', 'js/db.js', 'js/auth.js', 'js/data.js', 'js/calc.js', 'js/charts.js', 'js/notify.js', 'js/views.js', 'js/app.js'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => { if (e.request.method === 'GET') e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))); });
self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(clients.openWindow('./')); });
