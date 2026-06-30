const CACHE_NAME = "novaride-shell-v34";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css?v=20260630-005",
  "/app.js?v=20260630-002",
  "/assets/odessa-streets.json",
  "/manifest.webmanifest",
  "/assets/novadrive-logo.png",
  "/assets/location-picker.png",
  "/assets/tariff-comfort.png",
  "/assets/tariff-car-seat.png",
  "/assets/tariff-business.png",
  "/assets/tariff-minibus.png",
  "/assets/novadrive-icon-192.png",
  "/assets/novadrive-icon-512.png",
  "/assets/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html"))),
  );
});
