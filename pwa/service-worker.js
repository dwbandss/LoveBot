/**
 * pwa/service-worker.js  v3.0
 *
 * FIXES:
 *  - All asset paths are relative to SW scope (root), not pwa/ subfolder
 *  - Cache fails gracefully — missing assets don't abort install
 *  - Push notifications: receives push event and shows notification
 *    Clicking the notification opens the app and fires lb:notifMessage
 *
 * Bump CACHE_NAME when you deploy changes so users get fresh files.
 */
const CACHE_NAME = 'lovebot-v3.0';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data/messages.js',
  './modules/moodEngine.js',
  './modules/voiceEngine.js',
  './modules/voiceManager.js',
  './modules/unlockEngine.js',
  './modules/constellationEngine.js',
  './modules/surpriseEngine.js',
  './modules/adminEngine.js',
  './modules/emotionEngine.js',
  './modules/memoryAI.js',
  './modules/dailyEngine.js',
  './modules/notificationEngine.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

/* ── Install: cache assets, don't fail on individual misses ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: clear old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first, network fallback ── */
self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback: return index.html for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ── Push Notifications ── */
self.addEventListener('push', e => {
  let data = { title: 'LoveBot 💌', body: 'Someone is thinking of you ✦', tag: 'lovebot-msg' };
  try {
    if (e.data) {
      const parsed = e.data.json();
      data = { ...data, ...parsed };
    }
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    './assets/icons/icon-192.png',
      badge:   './assets/icons/icon-96.png',
      tag:     data.tag || 'lovebot-msg',
      renotify: true,
      vibrate: [200, 100, 200],
      data:    { message: data.body, url: './' },
    })
  );
});

/* ── Notification click: open app + pass message ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const msg = e.notification.data && e.notification.data.message;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const appClient = list.find(c => c.url.includes('index.html') || c.url.endsWith('/'));
      if (appClient) {
        appClient.focus();
        if (msg) appClient.postMessage({ type: 'lb:notifMessage', message: msg });
      } else {
        clients.openWindow('./').then(c => {
          if (c && msg) setTimeout(() => c.postMessage({ type: 'lb:notifMessage', message: msg }), 1500);
        });
      }
    })
  );
});
