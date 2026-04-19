const CACHE_NAME = 'boxing-timer-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './audio.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Roboto+Mono:wght@700&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
