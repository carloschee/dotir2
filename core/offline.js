/* ============================================================
   Dótir 2 — core/offline.js
   · Registro del Service Worker
   · API para precachear recursos de un módulo
   · Indicador de estado de conexión (online / offline / parcial)
   · Descarga bajo demanda con progreso
   ============================================================ */

const SW_URL = './sw.js';

// ── Registro del SW ───────────────────────────────────────────
export async function registrarSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Offline] Service Worker no soportado.');
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: './' });
    console.info('[Offline] SW registrado:', reg.scope);
    return reg;
  } catch (e) {
    console.error('[Offline] Error al registrar SW:', e);
    return null;
  }
}

// ── Comunicación con el SW ────────────────────────────────────
const _swReady = () =>
  navigator.serviceWorker?.ready ?? Promise.resolve(null);

/**
 * Envía un mensaje al SW activo.
 * @param {object} msg
 */
async function _swMsg(msg) {
  const reg = await _swReady();
  if (reg?.active) reg.active.postMessage(msg);
}

// ── Precaché de recursos de un módulo ────────────────────────
/**
 * Descarga y cachea una lista de URLs, reportando progreso.
 * @param {string[]} urls
 * @param {{ onProgress?: (done: number, total: number) => void }} opts
 * @returns {Promise<{ ok: number, total: number }>}
 */
export async function precachear(urls, { onProgress } = {}) {
  if (!urls?.length) return { ok: 0, total: 0 };

  return new Promise(resolve => {
    let recibido = false;

    // Escuchar respuesta del SW
    const handler = e => {
      if (e.data?.tipo !== 'precache-done' || recibido) return;
      recibido = true;
      navigator.serviceWorker.removeEventListener('message', handler);
      resolve({ ok: e.data.ok, total: e.data.total });
    };
    navigator.serviceWorker.addEventListener('message', handler);

    // Si el SW no responde en 30s, resolver con estimado
    setTimeout(() => {
      if (!recibido) {
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve({ ok: 0, total: urls.length });
      }
    }, 30_000);

    // Enviar al SW
    _swMsg({ tipo: 'precache', urls });

    // Progreso simulado mientras esperamos (el SW no reporta item a item)
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

/**
 * Comprueba si una URL ya está en caché.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export function estaEnCache(url) {
  return new Promise(resolve => {
    const handler = e => {
      if (e.data?.tipo === 'check-result' && e.data.url === url) {
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve(e.data.cached);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    _swMsg({ tipo: 'check', url });
    setTimeout(() => resolve(false), 3000); // fallback
  });
}

/**
 * Borra toda la caché.
 * @returns {Promise<void>}
 */
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
/**
 * Estados posibles del indicador:
 *   'online'   → conexión activa confirmada
 *   'offline'  → sin conexión
 *   'checking' → verificando
 */

let _estadoConexion = 'checking';
let _listeners      = [];

export function onConexionChange(fn) {
  _listeners.push(fn);
  // Llamar inmediatamente con el estado actual
  fn(_estadoConexion);
}

function _emitir(estado) {
  if (_estadoConexion === estado) return;
  _estadoConexion = estado;
  _listeners.forEach(fn => fn(estado));
}

async function _verificar() {
  if (!navigator.onLine) { _emitir('offline'); return; }
  // Ping ligero a un recurso del propio dominio
  try {
    const res = await fetch('./manifest.json', {
      method: 'HEAD',
      cache:  'no-store',
      signal: AbortSignal.timeout(4000),
    });
    _emitir(res.ok ? 'online' : 'offline');
  } catch {
    _emitir('offline');
  }
}

// Escuchar eventos nativos
window.addEventListener('online',  () => _verificar());
window.addEventListener('offline', () => _emitir('offline'));

// Verificar al iniciar y cada 4 minutos
_verificar();
setInterval(_verificar, 4 * 60 * 1000);

// ── fetchTimeout: fetch con timeout configurable ──────────────
/**
 * Realiza un fetch con timeout.
 * @param {string} url
 * @param {number} ms — milisegundos hasta abortar (default 8000)
 * @param {RequestInit} opts
 */
export function fetchTimeout(url, ms = 8000, opts = {}) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}
