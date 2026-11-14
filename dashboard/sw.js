/* Mia Dashboard: fa funzionare l'app anche senza connessione */
const V = "mia-dashboard-41";
const SHELL = ["./", "index.html", "sound.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("mia-dashboard") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== location.origin || !u.pathname.includes("/dashboard/")) return;
  if (req.mode === "navigate") {
    /* apertura dall'icona: prima la rete; su iPhone una risposta "reindirizzata" dà schermo nero, quindi la rifaccio pulita */
    e.respondWith(fetch(req.url, { cache: "no-store" }).then(r => {
      if (r.redirected) return Response.redirect(r.url, 302);
      if (r.ok) { const copy = r.clone(); caches.open(V).then(c => c.put("./", copy)); }
      return r;
    }).catch(() => caches.match("./").then(r => r || caches.match("index.html"))));
    return;
  }
  if (u.pathname.endsWith("/version.txt")) return;
  e.respondWith(fetch(req, { cache: "no-cache" }).then(r => { if (r.ok && !r.redirected) { const copy = r.clone(); caches.open(V).then(c => c.put(req, copy)); } return r; }).catch(() => caches.match(req)));
});
