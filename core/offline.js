/* ============================================================
   Dótir 2 — core/offline.js
   SW generado como Blob con URLs absolutas precalculadas,
   exactamente igual a como lo hace DJ Emmy para GitHub Pages.
   ============================================================ */

// ── Base URL del origen (calculada una vez al cargar) ─────────
const BASE = (() => {
  const href = window.location.href;
  // Quitar query string y hash, conservar el path hasta el último /
  return href.split('?')[0].split('#')[0].replace(/\/[^/]*$/, '/');
})();

const abs = path => new URL(path, BASE).href;

// ── Shell: recursos mínimos para que la app arranque ──────────
const SHELL = [
  abs('./'),
  abs('./index.html'),
  abs('./manifest.json'),
  abs('./core/tts.js'),
  abs('./core/offline.js'),
  abs('./core/ui.js'),
  abs('./core/audio.js'),
  abs('./modules/saac/module.js'),
  abs('./modules/saac/saac.js'),
  abs('./modules/memorama/module.js'),
  abs('./modules/memorama/memorama.js'),
  abs('./modules/ajustes/module.js'),
  abs('./modules/ajustes/ajustes.js'),
  abs('./data/saac.json'),
  abs('./data/memorama-temas.json'),
  abs('./data/memorama-frutas.json'),
  abs('./data/memorama-transportes.json'),
  abs('./data/memorama-vegetales.json'),
];

// ── Generar código del SW con URLs absolutas inyectadas ───────
const _swCode = () => `
const CACHE   = 'dotir2-v4';
const SHELL   = ${JSON.stringify(SHELL)};

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(SHELL.map(u => c.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isVideo = u => /\\.mp4(\\?|$)/i.test(u);
const isJson  = u => /\\.json(\\?|$)/i.test(u);

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;
  if (request.method !== 'GET') return;

  if (isVideo(url)) {
    e.respondWith(caches.open(CACHE).then(async cache => {
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
          'Content-Type':   cached.headers.get('Content-Type') || 'video/mp4',
          'Content-Range':  \`bytes \${start}-\${end}/\${blob.size}\`,
          'Content-Length': String(end - start + 1),
          'Accept-Ranges':  'bytes',
        },
      });
    }).catch(() => fetch(request)));
    return;
  }

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

self.addEventListener('message', async e => {
  if (e.data?.tipo === 'precache') {
    const cache = await caches.open(CACHE);
    let ok = 0;
    for (const url of (e.data.urls || [])) {
      try { const r = await fetch(url); if (r.ok) { await cache.put(url, r); ok++; } } catch (_) {}
    }
    e.source?.postMessage({ tipo: 'precache-done', total: (e.data.urls || []).length, ok });
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

// ── Registro del SW ───────────────────────────────────────────
export async function registrarSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Offline] SW no soportado.');
    return null;
  }
  try {
    // Desregistrar SW anteriores (archivo sw.js si quedó alguno)
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      // Solo desregistrar si es un SW de archivo (no blob)
      if (r.active?.scriptURL?.endsWith('sw.js')) await r.unregister();
    }

    const blob  = new Blob([_swCode()], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    const reg   = await navigator.serviceWorker.register(swUrl, { scope: './' });

    if (navigator.storage?.persist) navigator.storage.persist();
    console.info('[Offline] SW Blob registrado OK');
    return reg;
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

// ── Precaché de recursos (bajo demanda desde Ajustes) ─────────
export async function precachear(urls, { onProgress } = {}) {
  if (!urls?.length) return { ok: 0, total: 0 };
  // Convertir a absolutas por si alguna vino relativa
  const absUrls = urls.map(u => u.startsWith('http') ? u : abs(u));

  return new Promise(resolve => {
    let done = false;
    const handler = e => {
      if (e.data?.tipo !== 'precache-done' || done) return;
      done = true;
      navigator.serviceWorker.removeEventListener('message', handler);
      resolve({ ok: e.data.ok, total: e.data.total });
    };
    navigator.serviceWorker.addEventListener('message', handler);
    setTimeout(() => {
      if (done) return;
      navigator.serviceWorker.removeEventListener('message', handler);
      resolve({ ok: 0, total: absUrls.length });
    }, 30_000);

    _swMsg({ tipo: 'precache', urls: absUrls });

    if (onProgress) {
      let n = 0;
      const tick = setInterval(() => {
        if (n >= absUrls.length || done) { clearInterval(tick); return; }
        n = Math.min(n + Math.ceil(absUrls.length / 20), absUrls.length);
        onProgress(n, absUrls.length);
      }, 300);
    }
  });
}

export async function estaEnCache(url) {
  return new Promise(resolve => {
    const u = url.startsWith('http') ? url : abs(url);
    const handler = e => {
      if (e.data?.tipo === 'check-result' && e.data.url === u) {
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve(e.data.cached);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    _swMsg({ tipo: 'check', url: u });
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
    const res = await fetch(abs('./manifest.json'), {
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
