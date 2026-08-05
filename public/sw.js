/**
 * Stacks service worker.
 *
 * One job: make "do I already own this?" answerable in a bookshop with no
 * signal. It caches the app shell and the last library view you loaded.
 *
 * Deliberately hand-written rather than generated. It needs about sixty lines of
 * behaviour, and a build-time plugin would have to survive Turbopack and the
 * OpenNext bundling step — cost with no matching benefit.
 *
 * Writes are NOT queued. Adding a book offline would mean reconciling a lookup,
 * a dedup check and a unique constraint later; the app says so plainly instead.
 */

const VERSION = "v1";
const SHELL_CACHE = `stacks-shell-${VERSION}`;
const PAGE_CACHE = `stacks-pages-${VERSION}`;
const DATA_CACHE = `stacks-data-${VERSION}`;
const KEEP = new Set([SHELL_CACHE, PAGE_CACHE, DATA_CACHE]);

self.addEventListener("install", (event) => {
  // The shell is hashed and versioned by the build, so there is no fixed list to
  // precache; it fills in on first use instead.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("stacks-") && !KEEP.has(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * A redirected response means we were bounced to /login. Caching that under "/"
 * would serve the login page to a signed-in user, offline, forever.
 */
function isCacheable(response) {
  return response && response.ok && !response.redirected && response.type === "basic";
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (isCacheable(response)) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Auth must always hit the network — a cached session decision is a bug.
  if (url.pathname.startsWith("/api/auth/")) return;
  // The scanner is useless without a lookup, so never pretend it works offline.
  if (url.pathname.startsWith("/add")) return;
  // Exports must be live data, never a stale copy presented as a backup.
  if (url.pathname.startsWith("/api/export/")) return;

  // Build output is content-hashed, so it can be cached indefinitely.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/books")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, PAGE_CACHE).catch(async () => {
        // Last resort: the library itself, which is the page worth having.
        const cache = await caches.open(PAGE_CACHE);
        const home = await cache.match("/");
        if (home) return home;
        return new Response(
          "<!doctype html><meta charset=utf-8><title>Offline</title>" +
            "<body style=\"font-family:system-ui;padding:2rem;line-height:1.5\">" +
            "<h1>Offline</h1><p>Stacks hasn't cached a copy of your library yet. " +
            "Open it once with a connection and it will be available here.</p>",
          { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }),
    );
  }
});
