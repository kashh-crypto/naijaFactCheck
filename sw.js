// ── NaijaFactCheck Service Worker ─────────────────────────────────────────────
// Caches the app shell for offline use.
// Network-first for API calls, cache-first for static assets.

const CACHE_NAME    = "naijafactcheck-v3";
const CACHE_TIMEOUT = 5000; // ms before falling back to cache

const STATIC_ASSETS = [
  "/naijaFactCheck/",
  "/naijaFactCheck/index.html",
  "/naijaFactCheck/manifest.json",
  "/naijaFactCheck/icons/icon-192.png",
  "/naijaFactCheck/icons/icon-512.png",
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,400&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap",
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Pre-cache partial failure:", err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-only (never cache predictions)
  if (url.pathname === "/naijaFactCheck/predict" || url.hostname.endsWith(".hf.space")) {
    return; // let browser handle normally
  }

  // POST requests: pass through
  if (request.method !== "GET") return;

  // Static assets: cache-first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      // Not in cache — fetch and store
      return fetch(request)
        .then((response) => {
          if (
            response.ok &&
            (url.origin === self.location.origin ||
              url.hostname === "fonts.googleapis.com" ||
              url.hostname === "fonts.gstatic.com")
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached — return offline page fallback
          if (request.destination === "document") {
            return caches.match("/naijaFactCheck/index.html");
          }
        });
    })
  );
});
