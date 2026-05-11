/* Dotir 2 - modules/ajustes/ajustes.js */

import { borrarCache, precachear, fetchTimeout } from '../../core/offline.js';
import { toast, lanzarConfeti } from '../../core/ui.js';
import { Perfiles } from '../../core/perfiles.js';

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
export function onLeave() { }

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
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 24px;
        padding: 18px;
        display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        max-width: 560px;
        margin: 0 auto;
        width: 100%;
      }
      .aj-titulo {
        font-size: .72rem; font-weight: 900;
        text-transform: uppercase; letter-spacing: .1em;
        color: rgba(255,255,255,0.85);
      }
      .aj-fila {
        display: flex; align-items: center;
        justify-content: space-between; gap: 12px;
      }
      .aj-fila-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .aj-label { font-size: .92rem; font-weight: 800; color: white; }
      .aj-desc  { font-size: .72rem; color: rgba(255,255,255,0.65); font-weight: 600; }
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

      /* Perfiles */
      .aj-perfil-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .aj-perfil-item:last-child { border-bottom: none; }
      .aj-perfil-avatar {
        width: 44px; height: 44px; border-radius: 50%;
        object-fit: cover; flex-shrink: 0;
        background: rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem; overflow: hidden;
      }
      .aj-perfil-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .aj-perfil-info { flex: 1; min-width: 0; }
      .aj-perfil-apodo {
        color: white; font-size: .92rem; font-weight: 800;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .aj-perfil-meta {
        color: rgba(255,255,255,0.45); font-size: .7rem; font-weight: 600;
        margin-top: 2px;
      }
      .aj-perfil-activo-badge {
        font-size: .62rem; font-weight: 900; padding: 2px 8px;
        border-radius: 20px; background: #A855F7; color: white;
        flex-shrink: 0;
      }
      .aj-perfil-btns { display: flex; gap: 6px; flex-shrink: 0; }
      .aj-perfil-btn {
        width: 32px; height: 32px; border-radius: 50%;
        border: none; cursor: pointer; font-size: .85rem;
        display: flex; align-items: center; justify-content: center;
        transition: transform .12s;
      }
      .aj-perfil-btn:active { transform: scale(.88); }
      .aj-perfil-btn-activar { background: rgba(168,85,247,0.25); color: #c084fc; }
      .aj-perfil-btn-editar  { background: rgba(255,255,255,0.12); color: white; }
      .aj-perfil-btn-exportar { background: rgba(34,197,94,0.2); color: #4ade80; }
      .aj-perfil-btn-eliminar { background: rgba(239,68,68,0.2); color: #f87171; }

      /* Modal de perfil */
      #aj-modal-perfil {
        display: none; position: fixed; inset: 0; z-index: 100;
        background: rgba(10,8,30,0.85);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        align-items: center; justify-content: center; padding: 20px;
      }
      #aj-modal-perfil.visible { display: flex; }
      #aj-modal-perfil-box {
        background: rgba(30,30,58,0.98);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 28px; padding: 24px;
        width: 100%; max-width: 420px;
        display: flex; flex-direction: column; gap: 16px;
        max-height: 90vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
      #aj-modal-perfil-box h3 { color: white; font-size: 1rem; font-weight: 900; }
      .aj-modal-label {
        color: rgba(255,255,255,0.45); font-size: .7rem;
        font-weight: 900; text-transform: uppercase; letter-spacing: .08em;
        margin-bottom: 4px; display: block;
      }
      .aj-modal-input {
        width: 100%; padding: 12px 14px; border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07); color: white;
        font-size: .92rem; font-weight: 700; font-family: inherit;
        outline: none; -webkit-appearance: none;
      }
      .aj-modal-input:focus { border-color: #A855F7; }
      .aj-modal-textarea {
        width: 100%; padding: 12px 14px; border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07); color: white;
        font-size: .88rem; font-weight: 600; font-family: inherit;
        outline: none; resize: none; height: 90px;
        -webkit-appearance: none;
      }
      .aj-modal-textarea:focus { border-color: #A855F7; }
      #aj-avatar-preview {
        width: 72px; height: 72px; border-radius: 50%;
        background: rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        font-size: 2.2rem; overflow: hidden; flex-shrink: 0;
        border: 2px solid rgba(255,255,255,0.15);
      }
      #aj-avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
      .aj-avatar-row { display: flex; align-items: center; gap: 14px; }
      .aj-avatar-acciones { display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .aj-modal-btns { display: flex; gap: 10px; }
      .aj-modal-btns button {
        flex: 1; padding: 14px; border-radius: 16px; border: none;
        font-weight: 900; font-size: .92rem; cursor: pointer; font-family: inherit;
        transition: transform .12s;
      }
      .aj-modal-btns button:active { transform: scale(.95); }
      #btn-modal-guardar { background: #A855F7; color: white; }
      #btn-modal-cancelar {
        background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6);
        border: 1px solid rgba(255,255,255,0.15);
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
          ${['S', 'M', 'L'].map(t => `
            <button class="aj-tam-btn${tamano === t ? ' activo' : ''}" data-tam="${t}">
              ${t === 'S' ? 'Pequeno' : t === 'M' ? 'Mediano' : 'Grande'}
            </button>`).join('')}
        </div>
      </div>

            <div class="aj-seccion" id="aj-sec-perfiles">
        <p class="aj-titulo">Perfiles</p>
        <div id="aj-perfiles-lista"></div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Nuevo perfil</span>
            <span class="aj-desc">Crea un perfil para un usuario</span>
          </div>
          <button class="aj-btn aj-primary" id="btn-aj-nuevo-perfil">+ Crear</button>
        </div>
      </div>

      <p id="aj-versi on">Dotir 2 v2.0</p>

      <div id="aj-modal-perfil">
  <div id="aj-modal-perfil-box">
    <h3 id="aj-modal-titulo">Nuevo perfil</h3>
    <div class="aj-avatar-row">
      <div id="aj-avatar-preview">🧑</div>
      <div class="aj-avatar-acciones">
        <span class="aj-modal-label">Avatar</span>
        <input class="aj-modal-input" id="input-avatar-emoji"
               placeholder="Emoji (ej: 🐯)" maxlength="4">
        <button class="aj-btn aj-neutral" id="btn-avatar-foto"
                style="font-size:.78rem;padding:8px 12px;">
          📷 Subir foto
        </button>
        <input type="file" id="input-avatar-file"
               accept="image/*" style="display:none">
      </div>
    </div>
    <div>
      <span class="aj-modal-label">Apodo</span>
      <input class="aj-modal-input" id="input-apodo"
             placeholder="Ej: Tigre" maxlength="24">
    </div>
    <div>
      <span class="aj-modal-label">Fecha de nacimiento</span>
      <input class="aj-modal-input" id="input-fecha"
             type="date">
    </div>
    <div>
      <span class="aj-modal-label">Notas</span>
      <textarea class="aj-modal-textarea" id="input-notas"
                placeholder="Observaciones generales..."></textarea>
    </div>
    <div class="aj-modal-btns">
      <button id="btn-modal-cancelar">Cancelar</button>
      <button id="btn-modal-guardar">Guardar</button>
    </div>
  </div>
</div>

    </div>
  `;

  _q('#btn-aj-verificar').addEventListener('click', _actualizarEstadoConexion);

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
  const dot = _q('#aj-dot');
  const texto = _q('#aj-texto-conexion');
  if (!dot || !texto) return;
  dot.style.background = '#eab308';
  texto.textContent = 'Verificando...';
  if (!navigator.onLine) {
    dot.style.background = '#ef4444';
    texto.textContent = 'Sin conexion';
    return;
  }
  try {
    const res = await fetchTimeout('./manifest.json', 4000, { method: 'HEAD', cache: 'no-store' });
    if (!_container) return;                          // guard
    dot.style.background = res.ok ? '#22c55e' : '#ef4444';
    texto.textContent = res.ok ? 'En linea' : 'Sin conexion';
  } catch {
    if (!_container) return;                          // guard
    dot.style.background = '#ef4444';
    texto.textContent = 'Sin conexion';
  }
}

async function _descargarTodo() {
  const btn = _q('#btn-aj-descargar');
  const wrap = _q('#aj-progreso-wrap');
  const bar = _q('#aj-progreso-bar');
  const txt = _q('#aj-progreso-txt');
  if (!btn || !wrap || !bar || !txt) return;         // guard inicial

  btn.disabled = true;
  wrap.classList.add('visible');
  bar.style.width = '0%';
  txt.textContent = 'Recopilando recursos...';

  const urls = new Set([
    './index.html', './manifest.json', './sw.js',
    './core/tts.js', './core/offline.js', './core/ui.js', './core/audio.js',
    './assets/ui/btn-comunicador.png', './assets/ui/btn-memorama.png',
    './assets/ui/btn-musica.png', './assets/ui/btn-libros.png',
    './assets/ui/btn-videos.png', './assets/ui/btn-ajustes.png',
    './assets/ui/btn-inicio.png', './assets/ui/favicon.png',
    './modules/saac/module.js', './modules/saac/saac.js',
    './modules/memorama/module.js', './modules/memorama/memorama.js',
    './modules/libros/module.js', './modules/libros/libros.js',
    './modules/ajustes/module.js', './modules/ajustes/ajustes.js',
    './data/saac.json', './data/libros.json',
    './data/memorama-temas.json',
    './data/media.json',
    './modules/media/module.js', './modules/media/media.js',
  ]);

  const registry = window.DotirApp?.MODULE_REGISTRY || [];
  for (const mod of registry) {
    try {
      const cache = mod.buildCache
        ? await mod.buildCache()
        : (mod.cache || []);
      if (!_container) return;                        // guard
      cache.forEach(u => urls.add(u));
    } catch (_) { }
  }

  try {
    const r = await fetchTimeout('./data/saac.json', 6000);
    if (!_container) return;                          // guard
    if (r.ok) {
      const data = await r.json();
      if (!_container) return;                        // guard
      const cats = data.categorias || data;
      (Array.isArray(cats) ? cats : Object.values(cats)).forEach(cat => {
        (cat.items || []).forEach(item => {
          if (item.imagen) urls.add('./assets/pics/' + item.imagen);
        });
      });
    }
  } catch (_) { }

  try {
    const r = await fetchTimeout('./data/memorama-temas.json', 5000);
    if (!_container) return;                          // guard
    if (r.ok) {
      const temas = await r.json();
      if (!_container) return;                        // guard
      for (const meta of temas) {
        urls.add('./' + meta.archivo);
        try {
          const r2 = await fetchTimeout('./' + meta.archivo, 5000);
          if (!_container) return;                    // guard
          if (r2.ok) {
            const tema = await r2.json();
            if (!_container) return;                  // guard
            tema.items?.forEach(item => {
              if (tema.carpeta_img && item.imagen)
                urls.add('./' + tema.carpeta_img + item.imagen);
            });
          }
        } catch (_) { }
      }
    }
  } catch (_) { }
  // Descargar archivos de audio
  try {
    const r = await fetchTimeout('./data/media.json', 5000);
    if (!_container) return;
    if (r.ok) {
      const media = await r.json();
      if (!_container) return;
      media.forEach(item => {
        if (item.tipo === 'audio') {
          urls.add('./assets/audio/' + item.archivo + '.mp3');
          urls.add('./assets/audio/img/' + item.archivo + '.jpg');
        } else {
          urls.add('./assets/videos/' + item.archivo + '.mp4');
          urls.add('./assets/videos/img/' + item.archivo + '.jpg');
        }
      });
    }
  } catch (_) { }

  if (!_container) return;                            // guard antes de precachear

  const { ok, total } = await precachear([...urls], {
    onProgress: (d, t) => {
      if (!_container) return;                        // guard dentro del callback
      const pct = Math.round((d / t) * 100);
      bar.style.width = pct + '%';
      txt.textContent = d + ' de ' + t + ' archivos...';
    }
  });

  if (!_container) return;                            // guard post-precache

  bar.style.width = '100%';
  bar.style.background = ok === total ? '#22c55e' : '#f59e0b';
  txt.textContent = ok === total
    ? ok + ' archivos listos'
    : ok + ' de ' + total + ' descargados';

  lanzarConfeti({ count: 40, container: _container });
  toast('Descarga completada', { emoji: '\u{1F4E5}' });
  btn.disabled = false;

  // Listeners de perfiles
  _q('#btn-aj-nuevo-perfil').addEventListener('click', () => _abrirModal());
  _q('#btn-modal-cancelar').addEventListener('click', _cerrarModal);
  _q('#aj-modal-perfil').addEventListener('click', e => {
    if (e.target === _q('#aj-modal-perfil')) _cerrarModal();
  });
  _q('#btn-avatar-foto').addEventListener('click', () => {
    _q('#input-avatar-file').click();
  });
  _q('#input-avatar-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      _avatarFotoData = ev.target.result;
      const prev = _q('#aj-avatar-preview');
      prev.innerHTML = '<img src="' + _avatarFotoData + '">';
      _q('#input-avatar-emoji').value = '';
    };
    reader.readAsDataURL(file);
  });
  _q('#input-avatar-emoji').addEventListener('input', e => {
    const val = e.target.value.trim();
    if (val) {
      _avatarFotoData = null;
      _q('#aj-avatar-preview').innerHTML = val;
    }
  });
  _q('#btn-modal-guardar').addEventListener('click', _guardarPerfil);

  _renderPerfiles();
}

let _editandoId = null;
let _avatarFotoData = null;

function _renderPerfiles() {
  const lista = _q('#aj-perfiles-lista');
  if (!lista) return;
  lista.innerHTML = '';
  Perfiles.listar().forEach(p => {
    const esActivo = p.id === Perfiles.activoId;
    const edad = Perfiles.calcularEdad(p.fechaNacimiento);
    const item = document.createElement('div');
    item.className = 'aj-perfil-item';

    // Avatar
    const avatarEl = document.createElement('div');
    avatarEl.className = 'aj-perfil-avatar';
    if (p.avatarFoto) {
      avatarEl.innerHTML = '<img src="' + p.avatarFoto + '" alt="' + p.apodo + '">';
    } else {
      avatarEl.textContent = p.avatar || '🧑';
    }

    // Info
    const info = document.createElement('div');
    info.className = 'aj-perfil-info';
    info.innerHTML =
      '<div class="aj-perfil-apodo">' + p.apodo + '</div>' +
      '<div class="aj-perfil-meta">' +
      (edad !== null ? edad + ' años' : 'Sin fecha de nacimiento') +
      '</div>';

    // Badge activo
    const btns = document.createElement('div');
    btns.className = 'aj-perfil-btns';

    if (esActivo) {
      const badge = document.createElement('span');
      badge.className = 'aj-perfil-activo-badge';
      badge.textContent = 'Activo';
      btns.appendChild(badge);
    } else {
      const btnActivar = document.createElement('button');
      btnActivar.className = 'aj-perfil-btn aj-perfil-btn-activar';
      btnActivar.title = 'Activar perfil';
      btnActivar.textContent = '▶';
      btnActivar.addEventListener('click', () => {
        Perfiles.activar(p.id);
        _renderPerfiles();
        toast('Perfil activo: ' + p.apodo, { emoji: '👤' });
      });
      btns.appendChild(btnActivar);
    }

    // Editar
    const btnEditar = document.createElement('button');
    btnEditar.className = 'aj-perfil-btn aj-perfil-btn-editar';
    btnEditar.title = 'Editar';
    btnEditar.textContent = '✏️';
    btnEditar.addEventListener('click', () => _abrirModal(p.id));
    btns.appendChild(btnEditar);

    // Exportar (no para invitado)
    if (!p.esInvitado) {
      const btnExp = document.createElement('button');
      btnExp.className = 'aj-perfil-btn aj-perfil-btn-exportar';
      btnExp.title = 'Exportar';
      btnExp.textContent = '⬇️';
      btnExp.addEventListener('click', () => {
        Perfiles.exportar(p.id);
        toast('Perfil exportado', { emoji: '📥' });
      });
      btns.appendChild(btnExp);
    }

    // Eliminar (no para invitado)
    if (!p.esInvitado) {
      const btnDel = document.createElement('button');
      btnDel.className = 'aj-perfil-btn aj-perfil-btn-eliminar';
      btnDel.title = 'Eliminar';
      btnDel.textContent = '🗑';
      btnDel.addEventListener('click', () => {
        if (!confirm('¿Eliminar el perfil "' + p.apodo + '"? Esta acción no se puede deshacer.')) return;
        Perfiles.eliminar(p.id);
        _renderPerfiles();
        toast('Perfil eliminado', { emoji: '🗑️' });
      });
      btns.appendChild(btnDel);
    }

    item.append(avatarEl, info, btns);
    lista.appendChild(item);
  });
}

function _abrirModal(id) {
  _editandoId = id || null;
  _avatarFotoData = null;

  const titulo = _q('#aj-modal-titulo');
  const inputApodo = _q('#input-apodo');
  const inputEmoji = _q('#input-avatar-emoji');
  const inputFecha = _q('#input-fecha');
  const inputNotas = _q('#input-notas');
  const preview = _q('#aj-avatar-preview');

  if (id) {
    const p = Perfiles.listar().find(x => x.id === id);
    if (!p) return;
    titulo.textContent = 'Editar perfil';
    inputApodo.value = p.apodo;
    inputFecha.value = p.fechaNacimiento || '';
    inputNotas.value = p.notas || '';
    if (p.avatarFoto) {
      _avatarFotoData = p.avatarFoto;
      preview.innerHTML = '<img src="' + p.avatarFoto + '">';
      inputEmoji.value = '';
    } else {
      preview.textContent = p.avatar || '🧑';
      inputEmoji.value = p.avatar || '';
    }
  } else {
    titulo.textContent = 'Nuevo perfil';
    inputApodo.value = '';
    inputEmoji.value = '';
    inputFecha.value = '';
    inputNotas.value = '';
    preview.textContent = '🧑';
  }

  _q('#aj-modal-perfil').classList.add('visible');
}

function _cerrarModal() {
  _q('#aj-modal-perfil')?.classList.remove('visible');
  _editandoId = null;
  _avatarFotoData = null;
  const fileInput = _q('#input-avatar-file');
  if (fileInput) fileInput.value = '';
}

function _guardarPerfil() {
  const apodo = _q('#input-apodo').value.trim();
  if (!apodo) {
    toast('El apodo es requerido', { emoji: '⚠️' });
    return;
  }
  const emoji = _q('#input-avatar-emoji').value.trim();
  const datos = {
    apodo,
    avatar: emoji || '🧑',
    avatarFoto: _avatarFotoData || null,
    fechaNacimiento: _q('#input-fecha').value || null,
    notas: _q('#input-notas').value.trim(),
  };

  if (_editandoId) {
    Perfiles.actualizar(_editandoId, datos);
    toast('Perfil actualizado', { emoji: '✅' });
  } else {
    Perfiles.crear(datos);
    toast('Perfil creado', { emoji: '🎉' });
  }

  _cerrarModal();
  _renderPerfiles();
}