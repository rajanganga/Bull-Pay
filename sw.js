const CACHE_NAME = 'bullpay-v2'; // Version change karte rahein (v2, v3...)
const ASSETS = ['/', '/style.css', '/app.js', '/manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Naya update turant apply karo
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key); // Purana cache delete karo
        })
      );
    }).then(() => self.clients.claim()) // Turant control lo
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  
  // Network First, Fallback to Cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
