// Simple offline-first cache for static assets
const CACHE = "tpyaar-cache-v1"
const ASSETS = ["/", "/manifest.webmanifest", "/icons/tp-48.png", "/icons/tp-192.png", "/icons/tp-512.png"]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)))
})
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim())
})
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request).then((res) => {
            const copy = res.clone()
            caches
              .open(CACHE)
              .then((c) => c.put(e.request, copy))
              .catch(() => {})
            return res
          }),
      ),
    )
  }
})
