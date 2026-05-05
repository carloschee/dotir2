/* Dotir 2 - modules/ajustes/ajustes.js */

import { borrarCache, precachear, fetchTimeout } from '../../core/offline.js';
import { toast, lanzarConfeti } from '../../core/ui.js';

const LS_TAMANO = 'dotir2-saac-tamano';

let _container = null;
const _q = sel => _container?.querySelector(sel);

export async function init(container) {
  _container = container;
  _renderShell();
  _actualizarEstadoConexion();
}

export function destroy() { _container = null; }
export function onEnter() { _actualizarEstadoConexion(); }
export function onLeave() {}

function _renderShell() {
  const tamano = localStorage.getItem(LS_TAMANO) || 'M';

  _container.innerHTML = `
    <style>
      #aj-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow-y: auto;
        background: transparent;
        padding: 16px;
        gap: 14px;
        -webkit-overflow-scrolling: touch;
        padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
      }
      .aj-seccion {
        background: rgba(255,255,255,0.08);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 24px;
        padding: 18px;
        display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      }
      .aj-titulo {
        font-size: .72rem; font-weight: 900;
        text-transform: uppercase; letter-spacing: .1em;
        color: rgba(255,255,255,0.45);
      }
      .aj-fila {
        display: flex; align-items: center;
        justify-content: space-between; gap: 12px;
      }
      .aj-fila-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .aj-label { font-size: .92rem; font-weight: 800; color: white; }
      .aj-desc  { font-size: .72rem; color: rgba(255,255,255,0.45); font-weight: 600; }
      .aj-btn {
        border: none; border-radius: 14px; padding: 10px 18px;
        font-weight: 800; font-size: .82rem; cursor: pointer;
        transition: transform .12s; white-space: nowrap;
        font-family: inherit;
      }
      .aj-btn:active { transform: scale(.93); }
      .aj-primary { background: #A855F7; color: white; }
      .aj-danger  { background: #EF4444; color: white; }
      .aj-neutral {
        background: rgba(255,255,255,0.12);
        color: white;
        border: 1px solid rgba(255,255,255,0.2);
      }

      #aj-tamano-btns { display: flex; gap: 8px; }
      .aj-tam-btn {
        flex: 1; padding: 10px 6px; border-radius: 12px;
        border: 2px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08); color: white;
        font-weight: 800; font-size: .85rem; cursor: pointer;
        transition: all .15s; font-family: inherit;
      }
      .aj-tam-btn.activo { background: #A855F7; color: white; border-color: #A855F7; }

      #aj-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: #eab308; flex-shrink: 0; transition: background .3s;
      }

      #aj-progreso-wrap { display: none; flex-direction: column; gap: 6px; }
      #aj-progreso-wrap.visible { display: flex; }
      #aj-progreso-bg {
        height: 10px; border-radius: 20px;
        background: rgba(255,255,255,0.12); overflow: hidden;
      }
      #aj-progreso-bar {
        height: 100%; border-radius: 20px; width: 0%;
        background: linear-gradient(90deg, #7C3AED, #EC4899);
        transition: width .3s ease;
      }
      #aj-progreso-txt {
        font-size: .72rem; font-weight: 700;
        color: rgba(255,255,255,0.55); text-align: center;
      }
      #aj-version {
        text-align: center; font-size: .7rem; font-weight: 700;
        color: rgba(255,255,255,0.25); padding-bottom: 8px;
      }
    </style>

    <div id="aj-wrap">

      <div class="aj-seccion">
        <p class="aj-titulo">Conexion</p>
        <div class="aj-fila">
          <div style="display:flex;align-items:center;gap:10px;">
            <div id="aj-dot"></div>
            <span id="aj-texto-conexion" class="aj-label">Verificando...</span>
          </div>
          <button class="aj-btn aj-neutral" id="btn-aj-verificar">Verificar</button>
        </div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Modo avion</span>
            <span class="aj-desc">Usa solo contenido descargado previamente</span>
          </div>
          <button class="aj-btn aj-neutral" id="btn-aj-avion">Activar</button>
        </div>
      </div>

      <div class="aj-seccion">
        <p class="aj-titulo">Uso sin internet</p>
        <div id="aj-progreso-wrap">
          <div id="aj-progreso-bg"><div id="aj-progreso-bar"></div></div>
          <p id="aj-progreso-txt">Preparando...</p>
        </div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Descargar todo</span>
            <span class="aj-desc">Guarda la app para usarla sin internet</span>
          </div>
          <button class="aj-btn aj-primary" id="btn-aj-descargar">Descargar</button>
        </div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Borrar cache</span>
            <span class="aj-desc">Libera espacio en el dispositivo</span>
          </div>
          <button class="aj-btn aj-danger" id="btn-aj-borrar">Borrar</button>
        </div>
      </div>

      <div class="aj-seccion">
        <p class="aj-titulo">Aplicacion</p>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Actualizar app</span>
            <span class="aj-desc">Aplica la ultima version disponible</span>
          </div>
          <button class="aj-btn aj-neutral" id="btn-aj-refresh">Actualizar</button>
        </div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Reinicio completo</span>
            <span class="aj-desc">Borra cache y recarga desde el servidor</span>
          </div>
          <button class="aj-btn aj-danger" id="btn-aj-reset">Resetear</button>
        </div>
      </div>

      <div class="aj-seccion">
        <p class="aj-titulo">Comunicador</p>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Tamano de pictogramas</span>
            <span class="aj-desc">Ajusta el tamano de las tarjetas del tablero</span>
          </div>
        </div>
        <div id="aj-tamano-btns">
          ${['S','M','L'].map(t => `
            <button class="aj-tam-btn${tamano === t ? ' activo' : ''}" data-tam="${t}">
              ${t === 'S' ? 'Pequeno' : t === 'M' ? 'Mediano' : 'Grande'}
            </button>`).join('')}
        </div>
      </div>

      <p id="aj-version">Dotir 2 v2.0</p>

    </div>
  `;

  _q('#btn-aj-verificar').addEventListener('click', _actualizarEstadoConexion);

  let _avion = false;
  _q('#btn-aj-avion').addEventListener('click', () => {
    _avion = !_avion;
    const btn = _q('#btn-aj-avion');
    btn.textContent      = _avion ? 'Desactivar' : 'Activar';
    btn.style.background = _avion ? '#EF4444' : '';
    btn.style.color      = _avion ? 'white'   : '';
    navigator.serviceWorker?.controller?.postMessage({
      tipo: _avion ? 'forzar-offline' : 'forzar-online'
    });
    toast(_avion ? 'Modo avion activado' : 'Modo avion desactivado',
      { emoji: _avion ? '✈️' : '📶' });
  });

  _q('#btn-aj-descargar').addEventListener('click', _descargarTodo);

  _q('#btn-aj-borrar').addEventListener('click', async () => {
    const btn = _q('#btn-aj-borrar');
    btn.disabled = true;
    await borrarCache();
    toast('Cache borrada', { emoji: '🗑️' });
    btn.disabled = false;
  });

  _q('#btn-aj-refresh').addEventListener('click', async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.waiting) {
      reg.waiting.postMessage({ tipo: 'skipWaiting' });
      setTimeout(() => location.reload(), 400);
    } else {
      location.reload();
    }
  });

  _q('#btn-aj-reset').addEventListener('click', async () => {
    _q('#btn-aj-reset').disabled = true;
    await borrarCache();
    location.reload(true);
  });

  _q('#aj-tamano-btns').addEventListener('click', e => {
    const btn = e.target.closest('[data-tam]');
    if (!btn) return;
    const t = btn.dataset.tam;
    localStorage.setItem(LS_TAMANO, t);
    _q('#aj-tamano-btns').querySelectorAll('.aj-tam-btn').forEach(b =>
      b.classList.toggle('activo', b.dataset.tam === t)
    );
    const nombre = t === 'S' ? 'pequeno' : t === 'M' ? 'mediano' : 'grande';
    toast('Tamano ' + nombre, { emoji: '🔲' });
    window.DotirApp?.MODULE_REGISTRY?.find(m => m.id === 'saac')?.setTamano?.(t);
  });
}

async function _actualizarEstadoConexion() {
  const dot   = _q('#aj-dot');
  const texto = _q('#aj-texto-conexion');
  if (!dot || !texto) return;
  dot.style.background = '#eab308';
  texto.textContent    = 'Verificando...';
  if (!navigator.onLine) {
    dot.style.background = '#ef4444';
    texto.textContent    = 'Sin conexion';
    return;
  }
  try {
    const res = await fetchTimeout('./manifest.json', 4000, { method: 'HEAD', cache: 'no-store' });
    dot.style.background = res.ok ? '#22c55e' : '#ef4444';
    texto.textContent    = res.ok ? 'En linea' : 'Sin conexion';
  } catch {
    dot.style.background = '#ef4444';
    texto.textContent    = 'Sin conexion';
  }
}

async function _descargarTodo() {
  const btn  = _q('#btn-aj-descargar');
  const wrap = _q('#aj-progreso-wrap');
  const bar  = _q('#aj-progreso-bar');
  const txt  = _q('#aj-progreso-txt');

  btn.disabled = true;
  wrap.classList.add('visible');
  bar.style.width = '0%';
  txt.textContent = 'Recopilando recursos...';

  const urls = new Set([
    './index.html','./manifest.json',
    './core/tts.js','./core/offline.js','./core/ui.js','./core/audio.js',
    './modules/saac/module.js','./modules/saac/saac.js',
    './modules/memorama/module.js','./modules/memorama/memorama.js',
    './modules/ajustes/module.js','./modules/ajustes/ajustes.js',
    './data/saac.json',
    './data/memorama-temas.json',
    './data/memorama-frutas.json',
    './data/memorama-transportes.json',
    './data/memorama-vegetales.json',
  ]);

  (window.DotirApp?.MODULE_REGISTRY || []).forEach(m =>
    m.cache?.forEach(u => urls.add(u))
  );

  try {
    const r = await fetchTimeout('./data/memorama-temas.json', 5000);
    if (r.ok) {
      const temas = await r.json();
      for (const meta of temas) {
        try {
          const r2 = await fetchTimeout('./' + meta.archivo, 5000);
          if (r2.ok) {
            const tema = await r2.json();
            tema.items?.forEach(item => {
              if (tema.carpeta_img && item.imagen)
                urls.add('./' + tema.carpeta_img + item.imagen);
            });
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  const { ok, total } = await precachear([...urls], {
    onProgress: (d, t) => {
      const pct = Math.round((d / t) * 100);
      bar.style.width = pct + '%';
      txt.textContent = d + ' de ' + t + ' archivos...';
    }
  });

  bar.style.width      = '100%';
  bar.style.background = ok === total ? '#22c55e' : '#f59e0b';
  txt.textContent      = ok === total
    ? ok + ' archivos descargados'
    : ok + ' de ' + total + ' descargados';

  lanzarConfeti({ count: 40, container: _container });
  toast('Descarga completada', { emoji: '📥' });
  btn.disabled = false;
}