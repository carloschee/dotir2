/* ============================================================
   Dótir 2 — core/offline.js
   Adoptamos el enfoque de DJ Emmy: el Service Worker se genera
   como un Blob en memoria desde este módulo, sin archivo sw.js
   en disco. Esto garantiza que nunca quede atrapado en caché
   y que cualquier cambio se refleje en la siguiente carga.
   ============================================================ */

// ── Código del Service Worker (string) ───────────────────────
const SW_CODE = `
const CACHE = 'dotir2-v4';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './core/tts.js',
  './core/offline.js',
  './core/ui.js',
  './core/audio.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const isVideo = u => /\\.mp4(\\?|$)/i.test(u);
const isJson  = u => /\\.json(\\?|$)/i.test(u);

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;
  if (request.method !== 'GET') return;

  /* Video: cache-first con soporte Range */
  if (isVideo(url)) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (!cached) {
          const resp = await fetch(request);
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        }
        const range = request.headers.get('Range');
        if (!range) return cached;
        const blob  = await cached.blob();
        const m     = /bytes=(\\d*)-(\\d*)/.exec(range);
        const start = m[1] ? +m[1] : 0;
        const end   = m[2] ? +m[2] : blob.size - 1;
        return new Response(blob.slice(start, end + 1), {
          status: 206, statusText: 'Partial Content',
          headers: {
            'Content-Type':  cached.headers.get('Content-Type') || 'video/mp4',
            'Content-Range': \`bytes \${start}-\${end}/\${blob.size}\`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
          },
        });
      }).catch(() => fetch(request))
    );
    return;
  }

  /* JSON: network-first, fallback caché */
  if (isJson(url)) {
    e.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(request).then(c =>
          c || new Response('[]', { headers: { 'Content-Type': 'application/json' } })
        ))
    );
    return;
  }

  /* Todo lo demás: cache-first + actualización en BG */
  e.respondWith(
    caches.match(request).then(cached => {
      const net = fetch(request).then(resp => {
        if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
        return resp;
      });
      return cached || net;
    }).catch(() => new Response('Sin conexión', { status: 503 }))
  );
});

/* Mensajes desde la app */
self.addEventListener('message', async e => {
  if (e.data?.tipo === 'precache') {
    const cache = await caches.open(CACHE);
    let ok = 0;
    for (const url of (e.data.urls || [])) {
      try {
        const r = await fetch(url);
        if (r.ok) { await cache.put(url, r); ok++; }
      } catch (_) {}
    }
    e.source?.postMessage({ tipo: 'precache-done', total: e.data.urls.length, ok });
    return;
  }
  if (e.data?.tipo === 'check') {
    const c = await caches.match(e.data.url);
    e.source?.postMessage({ tipo: 'check-result', url: e.data.url, cached: !!c });
    return;
  }
  if (e.data?.tipo === 'clear') {
    await caches.delete(CACHE);
    e.source?.postMessage({ tipo: 'clear-done' });
  }
});
`;

// ── Registro del SW como Blob ─────────────────────────────────
let _swReg = null;

export async function registrarSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Offline] Service Worker no soportado.');
    return null;
  }
  try {
    const blob   = new Blob([SW_CODE], { type: 'application/javascript' });
    const swUrl  = URL.createObjectURL(blob);
    _swReg = await navigator.serviceWorker.register(swUrl, { scope: './' });
    console.info('[Offline] SW Blob registrado:', _swReg.scope);

    // Persistir almacenamiento si está disponible
    if (navigator.storage?.persist) {
      navigator.storage.persist().then(ok =>
        console.info('[Offline] Almacenamiento persistente:', ok)
      );
    }
    return _swReg;
  } catch (e) {
    console.error('[Offline] Error al registrar SW:', e);
    return null;
  }
}

// ── Comunicación con el SW ────────────────────────────────────
const _swReady = () => navigator.serviceWorker?.ready ?? Promise.resolve(null);

async function _swMsg(msg) {
  const reg = await _swReady();
  if (reg?.active) reg.active.postMessage(msg);
}

// ── Precaché de recursos ──────────────────────────────────────
export async function precachear(urls, { onProgress } = {}) {
  if (!urls?.length) return { ok: 0, total: 0 };

  return new Promise(resolve => {
    let recibido = false;
    const handler = e => {
      if (e.data?.tipo !== 'precache-done' || recibido) return;
      recibido = true;
      navigator.serviceWorker.removeEventListener('message', handler);
      resolve({ ok: e.data.ok, total: e.data.total });
    };
    navigator.serviceWorker.addEventListener('message', handler);
    setTimeout(() => {
      if (recibido) return;
      navigator.serviceWorker.removeEventListener('message', handler);
      resolve({ ok: 0, total: urls.length });
    }, 30_000);

    _swMsg({ tipo: 'precache', urls });

    if (onProgress) {
      let done = 0;
      const tick = setInterval(() => {
        if (done >= urls.length || recibido) { clearInterval(tick); return; }
        done = Math.min(done + Math.ceil(urls.length / 20), urls.length);
        onProgress(done, urls.length);
      }, 300);
    }
  });
}

export async function estaEnCache(url) {
  return new Promise(resolve => {
    const handler = e => {
      if (e.data?.tipo === 'check-result' && e.data.url === url) {
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve(e.data.cached);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    _swMsg({ tipo: 'check', url });
    setTimeout(() => resolve(false), 3000);
  });
}

export function borrarCache() {
  return new Promise(resolve => {
    const handler = e => {
      if (e.data?.tipo === 'clear-done') {
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    _swMsg({ tipo: 'clear' });
    setTimeout(resolve, 3000);
  });
}

// ── Indicador de conexión ─────────────────────────────────────
let _estado    = 'checking';
let _listeners = [];

export function onConexionChange(fn) {
  _listeners.push(fn);
  fn(_estado);
}

function _emitir(e) {
  if (_estado === e) return;
  _estado = e;
  _listeners.forEach(fn => fn(e));
}

async function _verificar() {
  if (!navigator.onLine) { _emitir('offline'); return; }
  try {
    const res = await fetch('./manifest.json', {
      method: 'HEAD', cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    _emitir(res.ok ? 'online' : 'offline');
  } catch { _emitir('offline'); }
}

window.addEventListener('online',  () => _verificar());
window.addEventListener('offline', () => _emitir('offline'));
_verificar();
setInterval(_verificar, 4 * 60 * 1000);

export function fetchTimeout(url, ms = 8000, opts = {}) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}