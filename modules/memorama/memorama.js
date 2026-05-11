/* Dotir 2 - modules/memorama/memorama.js */

import { TTS } from '../../core/tts.js';
import { lanzarConfeti, toast } from '../../core/ui.js';
import { fetchTimeout } from '../../core/offline.js';

const TEMAS_URL = './data/memorama-temas.json';
const PICS_BASE = './';
const MAX_PARES = 12;
const COLS_DESKTOP = 8;
const FILAS_DESKTOP = 3;
const COLS_MOVIL = 4;
const FILAS_MOVIL = 6;
const TEMAS_IMG_BASE = './assets/memorama/temas/';
const DORSOS_IMG_BASE = './assets/memorama/dorsos/';

const IDIOMAS = [
  { id: 'es-MX', bandera: '\u{1F1F2}\u{1F1FD}', lang: 'es-MX' },
  { id: 'en-US', bandera: '\u{1F1FA}\u{1F1F8}', lang: 'en-US' },
  { id: 'fr-FR', bandera: '\u{1F1EB}\u{1F1F7}', lang: 'fr-FR' },
  { id: 'zh-CN', bandera: '\u{1F1E8}\u{1F1F3}', lang: 'zh-CN' },
];

const LS_IDIOMAS = 'dotir2-mem-idiomas';
const TEMA_EMOJIS = { frutas: '\u{1F34E}', transportes: '\u{1F697}', vegetales: '\u{1F966}' };

const DORSOS = {
  frutas: {
    bg: 'linear-gradient(145deg,#1a4731 0%,#2d6a4f 40%,#52b788 100%)',
    svg: '<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><circle cx="15" cy="20" r="18" fill="rgba(255,255,255,0.08)"/><circle cx="65" cy="90" r="22" fill="rgba(255,255,255,0.08)"/><circle cx="70" cy="25" r="10" fill="rgba(255,255,255,0.10)"/><circle cx="10" cy="95" r="12" fill="rgba(255,255,255,0.07)"/><circle cx="40" cy="60" r="28" fill="rgba(255,255,255,0.05)"/></svg>',
  },
  transportes: {
    bg: 'linear-gradient(160deg,#03045e 0%,#0077b6 55%,#00b4d8 100%)',
    svg: '<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><line x1="0" y1="30" x2="80" y2="30" stroke="rgba(255,255,255,0.10)" stroke-width="8"/><line x1="0" y1="60" x2="80" y2="60" stroke="rgba(255,255,255,0.07)" stroke-width="5"/><line x1="0" y1="90" x2="80" y2="90" stroke="rgba(255,255,255,0.10)" stroke-width="8"/><polygon points="60,5 80,30 80,5" fill="rgba(255,200,0,0.20)"/><polygon points="0,90 20,120 0,120" fill="rgba(255,200,0,0.15)"/></svg>',
  },
  vegetales: {
    bg: 'linear-gradient(145deg,#3d2b1f 0%,#6b4c2a 45%,#a3793a 100%)',
    svg: '<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><ellipse cx="40" cy="115" rx="35" ry="18" fill="rgba(0,0,0,0.10)"/><path d="M40 100 Q20 70 25 40 Q40 10 55 40 Q60 70 40 100Z" fill="rgba(255,255,255,0.08)"/><path d="M40 100 Q55 75 50 50" stroke="rgba(255,255,255,0.15)" stroke-width="2" fill="none"/></svg>',
  },
  default: {
    bg: 'linear-gradient(135deg,#2d1b69 0%,#6a0dad 55%,#c0147a 100%)',
    svg: '<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><polygon points="40,5 75,30 62,70 18,70 5,30" fill="rgba(255,255,255,0.06)"/><circle cx="40" cy="60" r="15" fill="rgba(255,255,255,0.07)"/><circle cx="65" cy="15" r="16" fill="rgba(255,255,255,0.05)"/></svg>',
  },
};

let _container = null;
let _temas = [];
let _temaActivo = null;
let _itemMap = {};
let _cartas = [];
let _volteadas = [];
let _bloqueado = false;
let _parejas = 0;

let _idiomasActivos = new Set(
  JSON.parse(localStorage.getItem(LS_IDIOMAS) || '["es-MX"]')
);

const _q = sel => _container?.querySelector(sel);
const _idiomaAl = () => { const a = [..._idiomasActivos]; return a[Math.floor(Math.random() * a.length)]; };
const _nombre = (item, idioma) => item[idioma] || item['es-MX'] || String(item.id);
const _dorsoCache = {};
function _dorso(id) {
  return DORSOS[id] || DORSOS.default;
}
const _imgUrl = item => (_temaActivo?.carpeta_img && item?.imagen)
  ? `${PICS_BASE}${_temaActivo.carpeta_img}${item.imagen}` : null;

function _buildDorsoStyle(id) {
  const d = _dorso(id);
  // Si ya sabemos que la imagen cargó, usarla
  if (_dorsoCache[id] === 'ok') {
    return 'background:' + d.bg + ';background-image:url(' + DORSOS_IMG_BASE + id + '.png);background-size:auto;background-repeat:repeat;';
  }
  // Si ya sabemos que falló, usar gradiente
  if (_dorsoCache[id] === 'err') {
    return 'background:' + d.bg + ';';
  }
  // Primera vez: intentar imagen, con onerror como fallback
  return 'background:' + d.bg + ';background-image:url(' + DORSOS_IMG_BASE + id + '.png);background-size:auto;background-repeat:repeat;';
}

async function _cargarTemas() {
  if (_temas.length) return;
  try {
    const res = await fetchTimeout(TEMAS_URL, 6000);
    if (!res.ok) throw new Error('memorama-temas.json: ' + res.status);
    _temas = await res.json();
  } catch (e) {
    console.error('[Memorama]', e);
    _temas = [];
  }
}

async function _cargarTema(meta) {
  const res = await fetchTimeout('./' + meta.archivo, 6000);
  if (!res.ok) throw new Error(meta.archivo);
  return res.json();
}

export async function init(container) {
  _container = container;
  await _cargarTemas();
  _renderShell();
  _renderNavAcciones();
  _renderListaTemas();
  _mostrarModalTemas();
}

export function destroy() {
  if (_introTimeout) { clearTimeout(_introTimeout); _introTimeout = null; }
  _cartas = []; _volteadas = [];
  _temaActivo = null; _container = null;
  document.getElementById('modulo-acciones')?.replaceChildren();
  document.getElementById('mem-nav-style')?.remove();
}

export function pause() {
  document.getElementById('modulo-acciones')?.replaceChildren();
}

export async function resume(container) {
  _container = container;
  _renderNavAcciones();
  _renderListaTemas();
}

export function onEnter() { }
export function onLeave() { TTS.stop(); }

function _renderNavAcciones() {
  const acc = document.getElementById('modulo-acciones');
  if (!acc) return;
  acc.innerHTML = '';

  if (!document.getElementById('mem-nav-style')) {
    const s = document.createElement('style');
    s.id = 'mem-nav-style';
    s.textContent = '.mem-stat-nav{display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.7);font-size:.72rem;font-weight:700;}.mem-stat-nav strong{color:white;font-size:.85rem;}';
    document.head.appendChild(s);
  }

  const langsWrap = document.createElement('div');
  langsWrap.style.cssText = 'display:flex;gap:4px;';
  IDIOMAS.forEach(({ id, bandera }) => {
    const btn = document.createElement('button');
    btn.className = 'd-lang-btn' + (_idiomasActivos.has(id) ? ' activo' : '');
    btn.textContent = bandera; btn.title = id;
    btn.addEventListener('click', () => {
      if (_idiomasActivos.has(id) && _idiomasActivos.size <= 1) return;
      _idiomasActivos.has(id) ? _idiomasActivos.delete(id) : _idiomasActivos.add(id);
      localStorage.setItem(LS_IDIOMAS, JSON.stringify([..._idiomasActivos]));
      btn.classList.toggle('activo', _idiomasActivos.has(id));
    });
    langsWrap.appendChild(btn);
  });

  const btnNuevo = document.createElement('button');
  btnNuevo.className = 'd-nav-btn';
  btnNuevo.title = 'Nueva partida'; btnNuevo.textContent = '\u{1F504}';
  btnNuevo.addEventListener('click', () => { if (_temaActivo) _iniciarJuego(); });

  const btnTema = document.createElement('button');
  btnTema.className = 'd-nav-btn';
  btnTema.textContent = '\u{1F3B4} Tema';
  btnTema.addEventListener('click', _mostrarModalTemas);

  acc.append(langsWrap, btnNuevo, btnTema);
}

function _renderShell() {
  _container.innerHTML = `
    <style>
      #mem-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow: hidden;
        background: transparent; position: relative;
      }

      #mem-grid-wrap {
        flex: 1; min-height: 0;
        padding: 6px 8px 0;
        display: flex;
        opacity: 1;
        transition: opacity 0.4s ease;
      }
      #mem-grid-wrap.oculto { opacity: 0; }

      #mem-grid {
        width: 100%;
        display: grid;
        gap: 5px;
        grid-template-columns: repeat(8, 1fr);
        grid-template-rows: repeat(3, 1fr);
      }
  @media (max-width: 600px) {
    #mem-grid {
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(6, 1fr);
    }
}

      .mem-celda { perspective: 700px; min-height: 0; }
      .mem-carta {
        width: 100%; height: 100%; position: relative;
        cursor: pointer; transform-style: preserve-3d;
        transition: transform .45s cubic-bezier(.4,.2,.2,1);
        will-change: transform, opacity;
      }
      .mem-carta.volteada  { transform: rotateY(180deg); }
      .mem-carta.encontrada {
        animation: mem-desaparecer 0.5s cubic-bezier(.55,.06,.68,.19) forwards;
        pointer-events: none;
      }
      @keyframes mem-desaparecer {
        0%   { opacity:1; transform: rotateY(180deg) scale(1); }
        40%  { opacity:1; transform: rotateY(180deg) scale(1.08) translateY(-6px); }
        100% { opacity:0; transform: rotateY(180deg) scale(0); }
      }

      .mem-cara {
        position: absolute; inset: 0; border-radius: 9px;
        backface-visibility: hidden; -webkit-backface-visibility: hidden;
        overflow: hidden; display: flex; align-items: center; justify-content: center;
      }
      .mem-dorso {
        border: 2px solid rgba(255,255,255,0.42);
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      }
      .mem-frente {
        transform: rotateY(180deg); background: white;
        flex-direction: column; gap: 2px; padding: 4px;
        box-shadow: 0 3px 12px rgba(0,0,0,0.22);
      }
      .mem-frente img {
        width: 100%; flex: 1; min-height: 0;
        object-fit: contain; pointer-events: none;
      }
      .mem-label {
        font-size: clamp(.48rem, .85vw, .7rem); font-weight: 800;
        text-align: center; color: #1a1a2e; line-height: 1;
        flex-shrink: 0; pointer-events: none;
      }

      @keyframes mem-pop {
        from { opacity:0; transform: scale(.7) translateY(8px); }
        to   { opacity:1; transform: scale(1) translateY(0); }
      }
      .mem-celda { animation: mem-pop .32s cubic-bezier(.34,1.56,.64,1) both; }

      #mem-stack-wrap {
        flex-shrink: 0; height: 72px;
        padding: 5px 8px;
        background: rgba(0,0,0,0.20);
        border-top: 1px solid rgba(255,255,255,0.08);
        display: flex; align-items: center; gap: 5px;
        overflow-x: auto; overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      #mem-stack-wrap::-webkit-scrollbar { display: none; }

      .mem-par-tile {
        flex-shrink: 0; width: 58px; height: 58px;
        border-radius: 10px; overflow: hidden;
        background: white; cursor: pointer; position: relative;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: transform .12s ease;
        animation: mem-pop .3s cubic-bezier(.34,1.56,.64,1) both;
      }
      .mem-par-tile:active { transform: scale(0.88); }
      .mem-par-tile img {
        width: 100%; height: 100%; object-fit: contain;
        padding: 4px; pointer-events: none;
      }
      .mem-par-tile::after {
        content: attr(data-nombre);
        position: absolute; inset: 0;
        background: rgba(124,58,237,0.88);
        color: white; font-size: .62rem; font-weight: 800;
        display: flex; align-items: center;
        justify-content: center;
        text-align: center; padding: 3px;
        opacity: 0; transition: opacity .15s ease;
        border-radius: 10px;
      }
      .mem-par-tile.mostrar-nombre::after { opacity: 1; }

      /* Modal */
      #mem-modal {
        position: absolute; inset: 0; z-index: 40;
        background: transparent;
        display: flex; align-items: center; justify-content: center;
        opacity: 1;
        transition: opacity .35s ease;
        pointer-events: auto;
      }
      #mem-modal.oculto {
        opacity: 0;
        pointer-events: none;
      }
      #mem-modal-box {
        background: #1e1e3a; border-radius: 24px; padding: 24px;
        width: 90%; max-width: 340px;
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        display: flex; flex-direction: column; gap: 12px;
        max-height: 80vh; overflow-y: auto;
        transform: translateY(0);
        transition: transform .35s cubic-bezier(.34,1.1,.64,1), opacity .35s ease;
      }
      #mem-modal.oculto #mem-modal-box {
        transform: translateY(20px);
        opacity: 0;
      }
      #mem-modal-box h2 { color: white; font-size: 1.1rem; font-weight: 900; text-align: center; }

      .mem-tema-btn {
        width: 100%; display: flex; align-items: center; gap: 12px;
        padding: 14px 16px; border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.06); color: white;
        cursor: pointer; text-align: left; transition: background .15s;
      }
      .mem-tema-btn:active { background: rgba(255,255,255,0.16); }
      .mem-tema-btn .mt-emoji  { font-size: 2rem; }
      .mem-tema-btn .mt-titulo { font-weight: 900; font-size: 1.2rem; }

      #mem-modal-cancelar {
        width: 100%; padding: 11px; border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.55);
        font-size: .85rem; font-weight: 700; cursor: pointer;
        transition: background .15s;
      }
      #mem-modal-cancelar:active { background: rgba(255,255,255,0.14); }

      /* Intro */
      #mem-intro {
        position: absolute; inset: 0; z-index: 30;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 16px;
        background: transparent;
        opacity: 0;
        pointer-events: none;
        transition: opacity .4s ease;
      }
      #mem-intro.visible {
        opacity: 1;
        pointer-events: auto;
      }
      #mem-intro-titulo {
        color: white; font-size: 1.6rem; font-weight: 900;
        text-shadow: 0 2px 12px rgba(0,0,0,.5);
        transform: translateY(12px);
        transition: transform .4s cubic-bezier(.34,1.2,.64,1);
      }
      #mem-intro.visible #mem-intro-titulo {
        transform: translateY(0);
      }
      #mem-intro-elementos {
        display: flex; flex-wrap: wrap; justify-content: center;
        gap: 10px; max-width: 380px; padding: 0 16px;
      }

      @keyframes mem-flotar {
        0%,100% { transform: translateY(0) rotate(0deg); }
        33%      { transform: translateY(-12px) rotate(3deg); }
        66%      { transform: translateY(-6px) rotate(-2deg); }
      }
      .mem-flotar { animation: mem-flotar 2.4s ease-in-out infinite; }

      /* Victoria */
      #mem-victoria {
        position: absolute; inset: 0; z-index: 50;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px;
        pointer-events: none; transition: opacity .6s ease;
      }
      #mem-victoria.oculto { opacity: 0; pointer-events: none; }
      #mem-trofeo {
        font-size: 6rem;
        transition: transform .5s cubic-bezier(.175,.885,.32,1.275), opacity .5s;
        transform: scale(0); opacity: 0;
      }
      #mem-victoria-label { color: white; font-size: 1.3rem; font-weight: 900; text-shadow: 0 2px 12px rgba(0,0,0,.6); }
    </style>

    <div id="mem-wrap">
      <div id="mem-grid-wrap"><div id="mem-grid"></div></div>
      <div id="mem-stack-wrap"></div>

      <div id="mem-intro">
        <p id="mem-intro-titulo"></p>
        <div id="mem-intro-elementos"></div>
      </div>

      <div id="mem-victoria" class="oculto">
        <span id="mem-trofeo">\u{1F3C6}</span>
        <p id="mem-victoria-label">Muy bien!</p>
      </div>

      <div id="mem-modal">
        <div id="mem-modal-box">
          <h2>\u{1F3B4} Elige un tema</h2>
          <div id="mem-lista-temas"></div>
          <button id="mem-modal-cancelar" style="display:none">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function _mostrarModalTemas() {
  const modal = _q('#mem-modal');
  if (!modal) return;
  _q('#mem-grid-wrap')?.classList.add('oculto');
  modal.classList.remove('oculto');

  const btnCancel = _q('#mem-modal-cancelar');
  if (!btnCancel) return;
  btnCancel.style.display = _cartas.length > 0 ? '' : 'none';
  const fresh = btnCancel.cloneNode(true);
  btnCancel.replaceWith(fresh);
  fresh.addEventListener('click', _cerrarModal);
}

function _cerrarModal() {
  const modal = _q('#mem-modal');
  if (!modal) return;
  modal.classList.add('oculto');
  if (_cartas.length > 0) {
    setTimeout(() => _q('#mem-grid-wrap')?.classList.remove('oculto'), 350);
  }
}

function _renderListaTemas() {
  const lista = _q('#mem-lista-temas');
  if (!lista) return;
  lista.innerHTML = '';
  if (!_temas.length) {
    lista.innerHTML = '<p style="color:rgba(255,255,255,.4);text-align:center;font-size:.85rem;">No se encontraron temas.</p>';
    return;
  }
  _temas.forEach(meta => {
    const btn = document.createElement('button');
    btn.className = 'mem-tema-btn';

    const emoji = TEMA_EMOJIS[meta.id] || '\u{1F3B4}';
    const iconoEl = document.createElement('div');
    iconoEl.className = 'mt-emoji';

    if (meta.icono) {
      const img = document.createElement('img');
      img.src = TEMAS_IMG_BASE + meta.icono;
      img.alt = meta.titulo;
      img.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:8px;';
      img.onerror = () => {
        iconoEl.removeChild(img);
        iconoEl.textContent = emoji;
      };
      iconoEl.appendChild(img);
    } else {
      iconoEl.textContent = emoji;
    }

    const info = document.createElement('div');
    info.style.flex = '1';
    info.innerHTML = '<div class="mt-titulo">' + meta.titulo + '</div>';

    const flecha = document.createElement('span');
    flecha.style.cssText = 'color:rgba(255,255,255,.3);font-size:1.2rem';
    flecha.textContent = '›';

    btn.appendChild(iconoEl);
    btn.appendChild(info);
    btn.appendChild(flecha);
    btn.addEventListener('click', () => {
      TTS.speak(meta.titulo, { lang: 'es-MX', pitch: 1.2, rate: .95 });
      _activarTema(meta);
    });
    lista.appendChild(btn);
  });
}

// Agregar esta variable junto al resto del estado
let _introTimeout = null;

async function _activarTema(meta) {
  if (_introTimeout) { clearTimeout(_introTimeout); _introTimeout = null; }
  _cerrarModal();
  await new Promise(r => setTimeout(r, 360));
  if (!_container) return;
  try {
    const datos = await _cargarTema(meta);
    if (!_container) return;
    _temaActivo = datos;
    _itemMap = {};
    datos.items.forEach(item => { _itemMap[item.id] = item; });
    // TTS ya se llamó desde el gesto directo del usuario
    _mostrarIntro();
  } catch (e) {
    console.error('[Memorama]', e);
    toast('Error al cargar el tema', { emoji: '❌' });
  }
}

function _mostrarIntro() {
  if (!_temaActivo || !_container) return;
  const intro = _q('#mem-intro');
  if (!intro) return;

  _q('#mem-intro-titulo').textContent = _temaActivo.titulo;
  const el = _q('#mem-intro-elementos');
  el.innerHTML = '';
  _temaActivo.items.forEach((item, i) => {
    const url = _imgUrl(item);
    if (!url) return;
    const div = document.createElement('div');
    div.className = 'mem-flotar';
    div.style.animationDelay = (i % 8) * 0.18 + 's';
    div.style.animationDuration = (2.2 + (i % 4) * 0.3) + 's';
    const img = document.createElement('img');
    img.src = url; img.alt = item['es-MX'] || '';
    img.style.cssText = 'width:54px;height:54px;object-fit:contain;border-radius:8px;';
    img.onerror = () => div.remove();
    div.appendChild(img);
    el.appendChild(div);
  });

  intro.classList.add('visible');   // FIX: era remove('oculto')

  _introTimeout = setTimeout(() => {
    _introTimeout = null;
    if (!_container) return;
    _q('#mem-intro')?.classList.remove('visible');   // FIX: era add('oculto')
    _iniciarJuego();
  }, 2200);
}

function _iniciarJuego() {
  if (!_temaActivo) return;
  _cartas = []; _volteadas = [];
  _bloqueado = false; _parejas = 0;

  const items = [..._temaActivo.items].sort(() => Math.random() - 0.5).slice(0, MAX_PARES);
  _cartas = [...items, ...items]
    .sort(() => Math.random() - 0.5)
    .map((item, idx) => ({ idx, itemId: item.id, volteada: false, encontrada: false }));

  _renderGrid();
  _q('#mem-stack-wrap').innerHTML = '';

  const vict = _q('#mem-victoria'), trofeo = _q('#mem-trofeo');
  if (vict) { vict.classList.add('oculto'); vict.style.opacity = ''; }
  if (trofeo) { trofeo.style.transform = 'scale(0)'; trofeo.style.opacity = '0'; }

  const gridWrap = _q('#mem-grid-wrap');
  if (gridWrap) {
    gridWrap.classList.add('oculto');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { gridWrap.classList.remove('oculto'); });
    });
  }
}

function _renderGrid() {
  const grid = _q('#mem-grid');
  if (!grid) return;   // guard
  grid.innerHTML = '';
  // Probar si existe la imagen del dorso
  const temaId = _temaActivo?.id;
  if (temaId && _dorsoCache[temaId] === undefined) {
    const probe = new Image();
    probe.onload = () => { _dorsoCache[temaId] = 'ok'; };
    probe.onerror = () => { _dorsoCache[temaId] = 'err'; };
    probe.src = DORSOS_IMG_BASE + temaId + '.png';
  }
  const dorso = _dorso(_temaActivo?.id);
  _cartas.forEach((carta, i) => {
    const item = _itemMap[carta.itemId];
    const url = _imgUrl(item);
    const nombre = item ? _nombre(item, 'es-MX') : String(carta.itemId);
    const celda = document.createElement('div');
    celda.className = 'mem-celda';
    celda.style.animationDelay = (i * 0.025) + 's';
    const dorsoStyle = _buildDorsoStyle(_temaActivo?.id);
    celda.innerHTML =
      '<div class="mem-carta" data-idx="' + i + '">' +
      '<div class="mem-cara mem-dorso" style="' + dorsoStyle + '">' + dorso.svg + '</div>' +
      '<div class="mem-cara mem-frente">' +
      (url
        ? '<img src="' + url + '" alt="' + nombre + '" onerror="this.style.opacity=\'.15\'">'
        : '<span style="font-size:1.4rem">' + nombre + '</span>') +
      '<span class="mem-label">' + nombre + '</span>' +
      '</div>' +
      '</div>';
    celda.querySelector('.mem-carta').addEventListener('click', () => _voltear(i));
    grid.appendChild(celda);
  });
}

function _voltear(idx) {
  const carta = _cartas[idx];
  if (_bloqueado || carta.volteada || carta.encontrada) return;
  carta.volteada = true;
  _q('[data-idx="' + idx + '"]').classList.add('volteada');
  _volteadas.push(idx);
  if (_volteadas.length < 2) return;
  _bloqueado = true;
  const [a, b] = _volteadas;
  if (_cartas[a].itemId === _cartas[b].itemId) {
    const item = _itemMap[_cartas[a].itemId];
    const idioma = _idiomaAl();
    const langObj = IDIOMAS.find(l => l.id === idioma);
    TTS.speak(_nombre(item, idioma), { lang: langObj?.lang || 'es-MX', pitch: 1.2, rate: .9, delay: 250 });
    setTimeout(() => {
      _cartas[a].encontrada = _cartas[b].encontrada = true;
      _q('[data-idx="' + a + '"]').classList.add('encontrada');
      _q('[data-idx="' + b + '"]').classList.add('encontrada');
      _parejas++;
      _volteadas = []; _bloqueado = false;
      _agregarStack(_cartas[a].itemId, idioma);
      if (_parejas === MAX_PARES) setTimeout(_victoria, 500);
    }, 300);
  } else {
    setTimeout(() => {
      _q('[data-idx="' + a + '"]').classList.remove('volteada');
      _q('[data-idx="' + b + '"]').classList.remove('volteada');
      _cartas[a].volteada = _cartas[b].volteada = false;
      _volteadas = []; _bloqueado = false;
    }, 900);
  }
}

function _agregarStack(itemId, idioma) {
  const item = _itemMap[itemId];
  const nombre = _nombre(item, idioma);
  const url = _imgUrl(item);
  const stack = _q('#mem-stack-wrap');
  const tile = document.createElement('div');
  tile.className = 'mem-par-tile';
  tile.dataset.nombre = nombre;
  if (url) {
    const img = document.createElement('img');
    img.src = url; img.alt = nombre;
    tile.appendChild(img);
  } else {
    tile.textContent = nombre;
    tile.style.cssText += ';display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:#1a1a2e;text-align:center;padding:4px;';
  }
  tile.addEventListener('click', () => {
    const id2 = _idiomaAl();
    const nom2 = _nombre(item, id2);
    const lo = IDIOMAS.find(l => l.id === id2);
    tile.dataset.nombre = nom2;
    tile.classList.add('mostrar-nombre');
    TTS.speak(nom2, { lang: lo?.lang || 'es-MX', pitch: 1.2, rate: .9 });
    setTimeout(() => tile.classList.remove('mostrar-nombre'), 1400);
  });
  stack.appendChild(tile);
  requestAnimationFrame(() => { stack.scrollLeft = stack.scrollWidth; });
}

function _victoria() {
  lanzarConfeti({ container: _q('#mem-wrap') });
  TTS.speak('Muy bien!', { lang: 'es-MX', pitch: 1.3, rate: .9 });
  const vict = _q('#mem-victoria'), trofeo = _q('#mem-trofeo');
  if (vict) { vict.classList.remove('oculto'); vict.style.opacity = '1'; }
  if (trofeo) {
    requestAnimationFrame(() => {
      trofeo.style.transform = 'scale(1)'; trofeo.style.opacity = '1';
    });
  }
  setTimeout(() => {
    if (vict) vict.style.opacity = '0';
    setTimeout(() => {
      if (vict) { vict.classList.add('oculto'); vict.style.opacity = ''; }
      if (trofeo) { trofeo.style.transform = 'scale(0)'; trofeo.style.opacity = '0'; }
      _cartas = [];
      _mostrarModalTemas();
    }, 600);
  }, 3000);
}