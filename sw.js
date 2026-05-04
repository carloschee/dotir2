/* ============================================================
Dótir 2 — sw.js  (dotir2-v4)
Network-first para JS/HTML/CSS → cambios en repo siempre
visibles en la siguiente carga sin borrar caché.
Cache-first solo para video. Network-first para JSON.
============================================================ */

const CACHE = ‘dotir2-v4’;

self.addEventListener(‘install’, e => {
e.waitUntil(self.skipWaiting());
});

self.addEventListener(‘activate’, e => {
e.waitUntil(
caches.keys()
.then(ks => Promise.all(
ks.filter(k => k !== CACHE).map(k => caches.delete(k))
))
.then(() => self.clients.claim())
);
});

const isVideo = u => /.mp4(?|$)/i.test(u);
const isJson  = u => /.json(?|$)/i.test(u);

self.addEventListener(‘fetch’, e => {
const { request } = e;
const url = request.url;
if (request.method !== ‘GET’) return;

// ── Video: cache-first con soporte Range ─────────────────────
if (isVideo(url)) {
e.respondWith(caches.open(CACHE).then(async cache => {
const cached = await cache.match(request);
if (!cached) {
const resp = await fetch(request);
if (resp.ok) cache.put(request, resp.clone());
return resp;
}
const range = request.headers.get(‘Range’);
if (!range) return cached;
const blob  = await cached.blob();
const m     = /bytes=(\d*)-(\d*)/.exec(range);
const start = m[1] ? +m[1] : 0;
const end   = m[2] ? +m[2] : blob.size - 1;
return new Response(blob.slice(start, end + 1), {
status: 206, statusText: ‘Partial Content’,
headers: {
‘Content-Type’:   cached.headers.get(‘Content-Type’) || ‘video/mp4’,
‘Content-Range’:  `bytes ${start}-${end}/${blob.size}`,
‘Content-Length’: String(end - start + 1),
‘Accept-Ranges’:  ‘bytes’,
},
});
}).catch(() => fetch(request)));
return;
}

// ── JSON: network-first, fallback a caché ────────────────────
if (isJson(url)) {
e.respondWith(
fetch(request)
.then(resp => {
if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
return resp;
})
.catch(() => caches.match(request).then(c =>
c || new Response(’[]’, { headers: { ‘Content-Type’: ‘application/json’ } })
))
);
return;
}

// ── Todo lo demás: network-first ─────────────────────────────
// Siempre va a la red → cambios en el repo se ven de inmediato.
// Si no hay red, usa la caché como respaldo.
e.respondWith(
fetch(request)
.then(resp => {
if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
return resp;
})
.catch(() => caches.match(request).then(c =>
c || new Response(‘Sin conexión’, { status: 503 })
))
);
});

// ── Mensajes desde la app ─────────────────────────────────────
self.addEventListener(‘message’, async e => {
if (e.data?.tipo === ‘precache’) {
const cache = await caches.open(CACHE);
let ok = 0;
for (const url of (e.data.urls || [])) {
try {
const r = await fetch(url);
if (r.ok) { await cache.put(url, r); ok++; }
} catch (_) {}
}
e.source?.postMessage({ tipo: ‘precache-done’, total: (e.data.urls||[]).length, ok });
return;
}
if (e.data?.tipo === ‘check’) {
const c = await caches.match(e.data.url);
e.source?.postMessage({ tipo: ‘check-result’, url: e.data.url, cached: !!c });
return;
}
if (e.data?.tipo === ‘clear’) {
await caches.delete(CACHE);
e.source?.postMessage({ tipo: ‘clear-done’ });
}
});
