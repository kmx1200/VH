/* VHMaps — service worker : fonctionnement hors ligne */
const VERSION = "vhmaps-v7";
const SHELL = VERSION + "-shell";
const TILES = VERSION + "-tiles";      // tuiles vues en navigation (limité)
const DATA = VERSION + "-data";
const OFFLINE = "vhmaps-offline-tiles"; // cartes téléchargées volontairement : jamais effacées par une mise à jour
const DONNEES = "vhmaps-donnees";       // dalle, référentiel et PR (dossier donnees/) : conservés entre les versions
const MAX_TILES = 800;
const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
const PRECACHE = [
  "./", "index.html", "manifest.json",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  LEAFLET + "leaflet.min.js", LEAFLET + "leaflet.min.css"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== OFFLINE && k !== DONNEES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function networkFirst(req, cacheName) {
  const c = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
  return res;
}

// Données volumineuses et peu changeantes : on sert la copie locale tout de suite, on la met à jour en arrière-plan
async function staleWhileRevalidate(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  const net = fetch(new Request(req, { cache: "no-cache" })).then((res) => {
    if (res && res.ok) c.put(req, res.clone());
    return res;
  });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

// Tuiles : 1) cartes téléchargées, 2) tuiles déjà vues, 3) réseau
async function tileResponse(req) {
  for (const name of [OFFLINE, TILES]) {
    const c = await caches.open(name);
    const hit = await c.match(req, { ignoreVary: true });
    if (hit) return hit;
  }
  let res;
  try {
    res = await fetch(new Request(req.url, { mode: "cors", credentials: "omit" }));
  } catch (err) {
    try { return await fetch(req); } catch (err2) { return Response.error(); }   // serveur sans CORS : affichage seul, sans mise en cache
  }
  if (res && res.ok) {
    const c = await caches.open(TILES);
    c.put(req, res.clone()).then(() => trim(TILES, MAX_TILES)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "tile.openstreetmap.org" || (url.hostname === "data.geopf.fr" && url.pathname.startsWith("/wmts"))) {
    e.respondWith(tileResponse(req));
    return;
  }
  if (url.hostname === "api.github.com") {                  // liste des GPX du serveur
    e.respondWith(networkFirst(req, DATA).catch(() => Response.error()));
    return;
  }
  if (url.hostname === "cdnjs.cloudflare.com") {            // Leaflet
    e.respondWith(cacheFirst(req, SHELL));
    return;
  }
  if (url.origin === location.origin && url.pathname.includes("/donnees/")) {   // dalle, référentiel, PR
    e.respondWith(staleWhileRevalidate(req, DONNEES).catch(() => Response.error()));
    return;
  }
  if (url.origin === location.origin) {                     // appli, GPX, icônes : version en ligne d'abord
    const cache = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/") ? SHELL : url.pathname.includes("/itineraires") ? DATA : SHELL;
    e.respondWith(
      networkFirst(req, cache).catch(async () => (req.mode === "navigate" ? (await caches.match("index.html")) || (await caches.match("./")) : Response.error()))
    );
  }
});
