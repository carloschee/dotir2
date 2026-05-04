/* ============================================================
   Dótir 2 — modules/ajustes/ajustes.js
   Panel de configuración de la app.
   Secciones:
   · Estado de conexión y modo avión
   · Refresco de la app (actualizar SW)
   · Tamaño de pictograma en el SAAC (S / M / L)
   · Caché offline: descargar / borrar
   ============================================================ */

import { borrarCache, estaEnCache, precachear, fetchTimeout } from '../../core/offline.js';
import { toast, lanzarConfeti } from '../../core/ui.js';

const LS_TAMANO = 'dotir2-saac-tamano';

let _container = null;

// ── Ciclo de vida ─────────────────────────────────────────────
export async function init(container) {
  _container = container;
  _renderShell();
  _actualizarEstadoConexion();
}

export function destroy() {
  _container = null;
}

export function onEnter() { _actualizarEstadoConexion(); }
export function onLeave() {}

// ── Helpers DOM ───────────────────────────────────────────────
const _q = sel => _container?.querySelector(sel);

// ── Shell ─────────────────────────────────────────────────────
function _renderShell() {
  const tamano = localStorage.getItem(LS_TAMANO) || 'M';

  _container.innerHTML = `
    <style>
      #aj-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow-y: auto;
        background: var(--d-bg, #FFF8F0);
        padding: 20px 16px;
        gap: 16px;
        -webkit-overflow-scrolling: touch;
      }

      /* ── Sección ────────────────────────────────────── */
      .aj-seccion {
        background: white;
        border-radius: 20px;
        padding: 18px;
        display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 4px 16px rgba(168,85,247,0.10);
      }
      .aj-seccion-titulo {
        font-size: .72rem; font-weight: 900;
        text-transform: uppercase; letter-spacing: .1em;
        color: var(--d-muted, #9B7EC8);
        margin-bottom: -4px;
      }

      /* ── Fila de ajuste ─────────────────────────────── */
      .aj-fila {
        display: flex; align-items: center;
        justify-content: space-between; gap: 12px;
      }
      .aj-fila-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .aj-fila-label {
        font-size: .92rem; font-weight: 800;
        color: var(--d-text, #2D1B4E);
      }
      .aj-fila-desc {
        font-size: .72rem; color: var(--d-muted, #9B7EC8); font-weight: 600;
      }

      /* ── Botón de acción ─────────────────────────────── */
      .aj-btn {
        border: none; border-radius: 14px; padding: 10px 18px;
        font-weight: 800; font-size: .82rem; cursor: pointer;
        transition: transform .12s, opacity .15s;
        white-space: nowrap;
      }
      .aj-btn:active { transform: scale(.94); }
      .aj-btn-primary {
        background: var(--d-primary, #A855F7); color: white;
      }
      .aj-btn-danger  { background: #EF4444; color: white; }
      .aj-btn-neutral { background: #F3E8FF; color: #7C3AED; }

      /* ── Toggle de tamaño ────────────────────────────── */
      #aj-tamano-btns { display: flex; gap: 8px; }
      .aj-tamano-btn {
        flex: 1; padding: 10px 6px; border-radius: 12px;
        border: 2.5px solid #E9D5FF;
        background: white; color: #7C3AED;
        font-weight: 800; font-size: .85rem; cursor: pointer;
        transition: all .15s;
      }
      .aj-tamano-btn.activo {
        background: #A855F7; color: white; border-color: #A855F7;
      }

      /* ── Indicador de conexión ───────────────────────── */
      #aj-conexion-dot {
        width: 10px; height: 10px; border-radius: 50%;
        flex-shrink: 0; background: #eab308;
        transition: background .3s;
      }
      #aj-conexion-texto {
        font-weight: 800; font-size: .85rem;
        color: var(--d-text, #2D1B4E);
      }

      /* ── Barra de progreso de descarga ───────────────── */
      #aj-progreso-wrap {
        display: none; flex-direction: column; gap: 6px;
      }
      #aj-progreso-wrap.visible { display: flex; }
      #aj-progreso-bar-bg {
        height: 10px; border-radius: 20px;
        background: #E9D5FF; overflow: hidden;
      }
      #aj-progreso-bar {
        height: 100%; border-radius: 20px;
        background: linear-gradient(90deg, #7C3AED, #EC4899);
        width: 0%; transition: width .3s ease;
      }
      #aj-progreso-texto {
        font-size: .72rem; font-weight: 700; color: var(--d-muted, #9B7EC8);
        text-align: center;
      }

      /* ── Versión ─────────────────────────────────────── */
      #aj-version {
        text-align: center; font-size: .7rem; font-weight: 700;
        color: var(--d-muted, #9B7EC8); padding-bottom: 20px;
        padding-top: 4px;
      }
    </style>

    <div id="aj-wrap">

      <!-- ── CONEXIÓN ─────────────────────────────────── -->
      <div class="aj-seccion">
        <p class="aj-seccion-titulo">Conexión</p>

        <div class="aj-fila">
          <div style="display:flex;align-items:center;gap:10px;">
            <div id="aj-conexion-dot"></div>
            <span id="aj-conexion-texto">Verificando…</span>
          </div>
          <button class="aj-btn aj-btn-neutral" id="btn-aj-verificar">Verificar</button>
        </div>

        <!-- Modo avión: simula sin conexión forzando uso de caché -->
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-fila-label">✈️ Modo avión</span>
            <span class="aj-fila-desc">Usa solo contenido descargado previamente</span>
          </div>
          <button class="aj-btn aj-btn-neutral" id="btn-aj-avion">Activar</button>
        </div>
      </div>

      <!-- ── CACHÉ OFFLINE ─────────────────────────────── -->
      <div class="aj-seccion">
        <p class="aj-seccion-titulo">Uso sin internet</p>

        <!-- Progreso de descarga -->
        <div id="aj-progreso-wrap">
          <div id="aj-progreso-bar-bg"><div id="aj-progreso-bar"></div></div>
          <p id="aj-progreso-texto">Preparando descarga…</p>
        </div>

        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-fila-label">📥 Descargar todo</span>
            <span class="aj-fila-desc">Guarda la app para usarla sin internet</span>
          </div>
          <button class="aj-btn aj-btn-primary" id="btn-aj-descargar">Descargar</button>
        </div>

        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-fila-label">🗑️ Borrar caché</span>
            <span class="aj-fila-desc">Libera espacio y descarga de nuevo al conectarse</span>
          </div>
          <button class="aj-btn aj-btn-danger" id="btn-aj-borrar-cache">Borrar</button>
        </div>
      </div>

      <!-- ── APP ──────────────────────────────────────── -->
      <div class="aj-seccion">
        <p class="aj-seccion-titulo">Aplicación</p>

        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-fila-label">🔄 Actualizar app</span>
            <span class="aj-fila-desc">Recarga para aplicar la última versión disponible</span>
          </div>
          <button class="aj-btn aj-btn-neutral" id="btn-aj-refresh">Actualizar</button>
        </div>

        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-fila-label">🧹 Reinicio completo</span>
            <span class="aj-fila-desc">Borra caché y recarga desde el servidor</span>
          </div>
          <button class="aj-btn aj-btn-danger" id="btn-aj-hard-reset">Resetear</button>
        </div>
      </div>

      <!-- ── COMUNICADOR SAAC ──────────────────────────── -->
      <div class="aj-seccion">
        <p class="aj-seccion-titulo">Comunicador</p>

        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-fila-label">🔲 Tamaño de pictogramas</span>
            <span class="aj-fila-desc">Ajusta el tamaño de las tarjetas del tablero</span>
          </div>
        </div>
        <div id="aj-tamano-btns">
          ${['S','M','L'].map(t => `
            <button class="aj-tamano-btn${tamano === t ? ' activo' : ''}" data-tam="${t}">
              ${t === 'S' ? 'Pequeño' : t === 'M' ? 'Mediano' : 'Grande'}
            </button>`).join('')}
        </div>
      </div>

      <p id="aj-version">Dótir 2 · v2.0</p>

    </div>
  `;

  // ── Eventos ───────────────────────────────────────────────
  _q('#btn-aj-verificar').addEventListener('click', _actualizarEstadoConexion);

  // Modo avión
  let _modoAvion = false;
  _q('#btn-aj-avion').addEventListener('click', () => {
    _modoAvion = !_modoAvion;
    _q('#btn-aj-avion').textContent = _modoAvion ? 'Desactivar' : 'Activar';
    _q('#btn-aj-avion').style.background = _modoAvion ? '#EF4444' : '';
    _q('#btn-aj-avion').style.color      = _modoAvion ? 'white' : '';
    // Enviar mensaje al SW para forzar modo offline
    navigator.serviceWorker?.controller?.postMessage({
      tipo: _modoAvion ? 'forzar-offline' : 'forzar-online'
    });
    toast(_modoAvion ? 'Modo avión activado' : 'Modo avión desactivado',
      { emoji: _modoAvion ? '✈️' : '📶' });
  });

  // Descargar para offline
  _q('#btn-aj-descargar').addEventListener('click', _descargarTodo);

  // Borrar caché
  _q('#btn-aj-borrar-cache').addEventListener('click', async () => {
    _q('#btn-aj-borrar-cache').disabled = true;
    await borrarCache();
    toast('Caché borrada', { emoji: '🗑️' });
    _q('#btn-aj-borrar-cache').disabled = false;
  });

  // Actualizar (skip-waiting al SW nuevo si existe)
  _q('#btn-aj-refresh').addEventListener('click', async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.waiting) {
      reg.waiting.postMessage({ tipo: 'skipWaiting' });
      setTimeout(() => location.reload(), 400);
    } else {
      location.reload();
    }
  });

  // Hard reset
  _q('#btn-aj-hard-reset').addEventListener('click', async () => {
    _q('#btn-aj-hard-reset').disabled = true;
    await borrarCache();
    location.reload(true);
  });

  // Tamaño de pictograma
  _q('#aj-tamano-btns').addEventListener('click', e => {
    const btn = e.target.closest('[data-tam]');
    if (!btn) return;
    const t = btn.dataset.tam;
    localStorage.setItem(LS_TAMANO, t);
    _q('#aj-tamano-btns').querySelectorAll('.aj-tamano-btn').forEach(b =>
      b.classList.toggle('activo', b.dataset.tam === t)
    );
    toast(`Tamaño ${t === 'S' ? 'pequeño' : t === 'M' ? 'mediano' : 'grande'}`, { emoji: '🔲' });
    // Notificar al módulo SAAC si está pausado/activo
    window.DotirApp?.MODULE_REGISTRY
      ?.find(m => m.id === 'saac')?.setTamano?.(t);
  });
}

// ── Estado de conexión ────────────────────────────────────────
async function _actualizarEstadoConexion() {
  const dot   = _q('#aj-conexion-dot');
  const texto = _q('#aj-conexion-texto');
  if (!dot || !texto) return;

  dot.style.background   = '#eab308';
  texto.textContent      = 'Verificando…';

  if (!navigator.onLine) {
    dot.style.background = '#ef4444';
    texto.textContent    = 'Sin conexión';
    return;
  }

  try {
    const res = await fetchTimeout('./manifest.json', 4000, {
      method: 'HEAD', cache: 'no-store'
    });
    if (res.ok) {
      dot.style.background = '#22c55e';
      texto.textContent    = 'En línea';
    } else {
      throw new Error();
    }
  } catch {
    dot.style.background = '#ef4444';
    texto.textContent    = 'Sin conexión';
  }
}

// ── Descargar todo para uso offline ──────────────────────────
async function _descargarTodo() {
  const btn      = _q('#btn-aj-descargar');
  const progWrap = _q('#aj-progreso-wrap');
  const progBar  = _q('#aj-progreso-bar');
  const progTxt  = _q('#aj-progreso-texto');

  btn.disabled = true;
  progWrap.classList.add('visible');
  progBar.style.width = '0%';
  progTxt.textContent = 'Recopilando recursos…';

  // Recopilar URLs desde MODULE_REGISTRY
  const registry = window.DotirApp?.MODULE_REGISTRY || [];
  const urls = new Set([
    './index.html', './manifest.json', './sw.js',
    './core/tts.js', './core/offline.js', './core/ui.js', './core/audio.js',
    './modules/saac/module.js', './modules/saac/saac.js',
    './modules/memorama/module.js', './modules/memorama/memorama.js',
    './modules/ajustes/module.js', './modules/ajustes/ajustes.js',
    './data/saac.json',
    './data/memorama-temas.json',
    './data/memorama-frutas.json',
    './data/memorama-transportes.json',
    './data/memorama-vegetales.json',
  ]);

  // Agregar caché declarada por cada módulo
  registry.forEach(mod => mod.cache?.forEach(u => urls.add(u)));

  // Intentar leer JSONs de temas para agregar imágenes
  try {
    const res = await fetchTimeout('./data/memorama-temas.json', 5000);
    if (res.ok) {
      const temas = await res.json();
      for (const meta of temas) {
        try {
          const r2 = await fetchTimeout(`./${meta.archivo}`, 5000);
          if (r2.ok) {
            const tema = await r2.json();
            tema.items?.forEach(item => {
              if (tema.carpeta_img && item.imagen)
                urls.add(`./${tema.carpeta_img}${item.imagen}`);
            });
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  const urlArr = [...urls];
  let done = 0;

  const { ok, total } = await import('../../core/offline.js').then(m =>
    m.precachear(urlArr, {
      onProgress: (d, t) => {
        done = d;
        const pct = Math.round((d / t) * 100);
        if (progBar) progBar.style.width = pct + '%';
        if (progTxt) progTxt.textContent = `${d} de ${t} archivos…`;
      }
    })
  );

  progBar.style.width     = '100%';
  progBar.style.background = ok === total ? '#22c55e' : '#f59e0b';
  progTxt.textContent      = ok === total
    ? `✅ ${ok} archivos descargados`
    : `⚠️ ${ok} de ${total} descargados`;

  lanzarConfeti({ count: 40, container: _container });
  toast('Descarga completada', { emoji: '📥' });
  btn.disabled = false;
}
