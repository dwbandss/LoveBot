/**
 * pwa/service-worker.js
 * Cache-first offline support for LoveBot.
 * Bump CACHE_NAME to force refresh after updates.
 */
const CACHE_NAME = 'lovebot-v2.0';

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
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
