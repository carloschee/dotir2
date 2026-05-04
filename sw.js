/* ============================================================
   Dótir 2 — Service Worker
   Estrategia:
   · HTML/JS/CSS/imágenes → cache-first + actualización en BG
   · JSON de datos        → network-first, fallback a caché
   · Video (.mp4)         → cache-first con soporte Range (streaming)
   · Audio (.mp3)         → cache-first
   ============================================================ */

const CACHE_NAME = 'dotir2-v2';

// Recursos del shell que se precargan al instalar
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './core/tts.js',
  './core/offline.js',
  './core/ui.js',
  './core/audio.js',
];

// ── Instalación ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activación ───────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────
const isVideo  = url => /\.mp4(\?|$)/i.test(url);
const isAudio  = url => /\.mp3(\?|$)/i.test(url);
const isJson   = url => /\.json(\?|$)/i.test(url);
const isModule = url => /\/modules\//.test(url);

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;

  // Ignorar peticiones que no sean GET
  if (request.method !== 'GET') return;

  // ── Video: cache-first con soporte Partial Content (Range) ──
  if (isVideo(url)) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);

        // Sin caché → traer de red, guardar y devolver
        if (!cached) {
          const resp = await fetch(request);
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        }

        // Con caché → manejar Range si el cliente lo pide
        const rangeHeader = request.headers.get('Range');
        if (!rangeHeader) return cached;

        const blob  = await cached.blob();
        const bytes = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        const start = bytes[1] ? parseInt(bytes[1]) : 0;
        const end   = bytes[2] ? parseInt(bytes[2]) : blob.size - 1;
        const slice = blob.slice(start, end + 1);

        return new Response(slice, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type':  cached.headers.get('Content-Type') || 'video/mp4',
            'Content-Range': `bytes ${start}-${end}/${blob.size}`,
            'Content-Length': String(slice.size),
            'Accept-Ranges':  'bytes',
          },
        });
      }).catch(() => fetch(request))
    );
    return;
  }

  // ── JSON de datos: network-first, actualiza caché ────────────
  if (isJson(url)) {
    e.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, resp.clone()));
          }
          return resp;
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || new Response('[]', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        )
    );
    return;
  }

  // ── Todo lo demás: cache-first, actualización en background ──
  e.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(resp => {
        if (resp.ok) {
          caches.open(CACHE_NAME).then(c => c.put(request, resp.clone()));
        }
        return resp;
      });
      return cached || fetchPromise;
    }).catch(() =>
      new Response('Sin conexión', { status: 503 })
    )
  );
});

// ── Mensajes desde la app ────────────────────────────────────
self.addEventListener('message', async e => {
  // Precaché a pedido: { tipo: 'precache', urls: [...] }
  if (e.data?.tipo === 'precache') {
    const cache = await caches.open(CACHE_NAME);
    const urls  = e.data.urls || [];
    let ok = 0;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) { await cache.put(url, res); ok++; }
      } catch (_) { /* sin conexión o recurso no disponible */ }
    }
    e.source?.postMessage({ tipo: 'precache-done', total: urls.length, ok });
    return;
  }

  // Consultar si una URL está en caché: { tipo: 'check', url }
  if (e.data?.tipo === 'check') {
    const cached = await caches.match(e.data.url);
    e.source?.postMessage({ tipo: 'check-result', url: e.data.url, cached: !!cached });
    return;
  }

  // Borrar caché completa: { tipo: 'clear' }
  if (e.data?.tipo === 'clear') {
    await caches.delete(CACHE_NAME);
    e.source?.postMessage({ tipo: 'clear-done' });
  }
});
