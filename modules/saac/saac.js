/* Dotir 2 - modules/saac/saac.js */

import { TTS         } from '../../core/tts.js';
import { fetchTimeout } from '../../core/offline.js';
import { toast        } from '../../core/ui.js';

const DATA_URL     = './data/saac.json';
const PICS_BASE    = './assets/saac/';
const LS_FAVS      = 'dotir2-saac-favs';
const LS_HISTORIAL = 'dotir2-saac-historial';
const LS_TAMANO    = 'dotir2-saac-tamano';
const HISTORIAL_MAX = 10;
const LONGPRESS_MS  = 500;

let _datos     = null;
let _favs      = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || '[]'));
let _historial = JSON.parse(localStorage.getItem(LS_HISTORIAL) || '[]');
let _frase     = [];
let _catActiva = 'favs';
let _busqueda  = '';
let _tamano    = localStorage.getItem(LS_TAMANO) || 'M';
let _container = null;
let _lpActivo = null;

const _guardarFavs      = () => localStorage.setItem(LS_FAVS,      JSON.stringify([..._favs]));
const _guardarHistorial = () => localStorage.setItem(LS_HISTORIAL, JSON.stringify(_historial));
const _norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function _cargarDatos() {
  if (_datos) return _datos;
  try {
    const res = await fetchTimeout(DATA_URL, 6000);
    if (!res.ok) throw new Error('saac.json: ' + res.status);
    _datos = await res.json();
  } catch (e) {
    console.error('[SAAC]', e);
    _datos = { categorias: [], vocabulario: [] };
  }
  return _datos;
}

export async function init(container) {
  _container = container;
  await _cargarDatos();
  _renderShell();
  _renderCategorias();
  _renderGrid();
}

export function pause() {
  if (_lpActivo) { clearTimeout(_lpActivo); _lpActivo = null; }
  _container = null;
}

export function destroy() {
  if (_lpActivo) { clearTimeout(_lpActivo); _lpActivo = null; }
  _frase     = [];
  _busqueda  = '';
  _catActiva = 'favs';
  _datos     = null;
  _container = null;
}

export async function resume(container) {
  _container = container;
  _renderShell();
  _renderCategorias();
  _renderGrid();
  if (_frase.length) _renderFrase();
}

export function setTamano(t) {
  if (!['S', 'M', 'L'].includes(t)) return;
  _tamano = t;
  localStorage.setItem(LS_TAMANO, t);
  const grid = _container?.querySelector('#saac-grid');
  if (grid) {
    grid.classList.remove('tam-S', 'tam-M', 'tam-L');
    grid.classList.add('tam-' + t);
  }
}

export function getTamano() { return _tamano; }

export function onEnter() {}

function _renderShell() {
  _container.innerHTML = `
    <style>
      #saac-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow: hidden;
        background: transparent;
      }

      /* Barra de frase */
      #saac-frase-bar {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; flex-shrink: 0;
        min-height: 88px;
        background: rgba(0,0,0,0.35);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      #saac-frase-scroll {
        flex: 1; display: flex; gap: 8px;
        overflow-x: auto; align-items: center;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      #saac-frase-scroll::-webkit-scrollbar { display: none; }

      .frase-item {
        display: flex; flex-direction: column; align-items: center;
        gap: 3px; cursor: pointer; flex-shrink: 0;
        padding: 6px; border-radius: 12px;
        transition: background 0.15s;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .frase-item:active { background: rgba(239,68,68,0.25); }
      .frase-item img {
        width: 52px; height: 52px;
        object-fit: contain; border-radius: 8px;
        pointer-events: none;
        background: rgba(255,255,255,0.06);
      }
      .frase-item span {
        font-size: 0.6rem; font-weight: 700;
        color: rgba(255,255,255,0.75);
        text-align: center; max-width: 60px;
        line-height: 1.1; pointer-events: none;
      }

      .saac-btn-accion {
        flex-shrink: 0; border: none;
        border-radius: 50%; color: white;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 1.2rem;
        transition: transform 0.12s, filter 0.12s;
      }
      .saac-btn-accion:active { transform: scale(0.9); filter: brightness(0.8); }
      #btn-saac-hablar    { width: 58px; height: 58px; background: #22c55e; font-size: 1.5rem; }
      #btn-saac-borrar    { width: 42px; height: 42px; background: #ef4444; font-size: 1rem; }
      #btn-saac-historial { width: 38px; height: 38px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); font-size: 0.9rem; }

      /* Categorias */
      #saac-cats {
        display: flex; gap: 6px; overflow-x: auto;
        padding: 8px 12px; flex-shrink: 0;
        background: rgba(0,0,0,0.25);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-bottom: 1px solid rgba(255,255,255,0.07);
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      #saac-cats::-webkit-scrollbar { display: none; }

      .cat-chip {
        display: flex; align-items: center; gap: 5px;
        padding: 6px 14px; border-radius: 20px;
        border: 2px solid transparent;
        font-size: 0.78rem; font-weight: 700;
        white-space: nowrap; cursor: pointer;
        transition: all 0.15s; flex-shrink: 0;
        opacity: 0.6;
      }
      .cat-chip.activa { opacity: 1; transform: scale(1.05); border-color: rgba(255,255,255,0.4); }
      .cat-chip:active { opacity: 0.8; transform: scale(0.96); }

      /* Busqueda */
      #saac-busqueda-wrap {
        padding: 8px 12px; flex-shrink: 0;
        background: rgba(0,0,0,0.20);
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      #saac-busqueda {
        width: 100%; padding: 10px 16px;
        border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.15);
        font-size: 0.88rem; font-family: inherit;
        outline: none;
        background: rgba(255,255,255,0.08);
        color: white;
        -webkit-appearance: none;
      }
      #saac-busqueda::placeholder { color: rgba(255,255,255,0.35); }
      #saac-busqueda:focus { border-color: rgba(168,85,247,0.7); }

      /* Grid */
      #saac-grid-wrap {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        padding: 10px 8px;
        -webkit-overflow-scrolling: touch;
        position: relative;
      }
      #saac-grid {
        display: grid; gap: 8px;
      }
      #saac-grid.tam-S { grid-template-columns: repeat(auto-fill, minmax(82px,  1fr)); }
      #saac-grid.tam-M { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); }
      #saac-grid.tam-L { grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); }

      .picto-card {
        border-radius: 14px; padding: 10px 6px 8px;
        display: flex; flex-direction: column;
        align-items: center; gap: 6px;
        cursor: pointer; position: relative;
        border-bottom: 4px solid rgba(0,0,0,0.25);
        transition: transform 0.12s;
        user-select: none; -webkit-user-select: none;
      }
      .picto-card:active { transform: scale(0.93); }
      .picto-card img {
        object-fit: contain; pointer-events: none;
        border-radius: 8px;
        background: rgba(255,255,255,0.12);
      }
      #saac-grid.tam-S .picto-card img { width: 58px;  height: 58px; }
      #saac-grid.tam-M .picto-card img { width: 78px;  height: 78px; }
      #saac-grid.tam-L .picto-card img { width: 100px; height: 100px; }

      .picto-label {
        font-weight: 700; text-align: center; line-height: 1.15;
        pointer-events: none;
      }
      #saac-grid.tam-S .picto-label { font-size: 0.68rem; }
      #saac-grid.tam-M .picto-label { font-size: 0.75rem; }
      #saac-grid.tam-L .picto-label { font-size: 0.82rem; }

      .fav-dot {
        position: absolute; top: 5px; right: 6px;
        font-size: 0.75rem; opacity: 0;
        transition: opacity 0.2s;
      }
      .picto-card.es-fav .fav-dot { opacity: 1; }

      /* Estado vacio */
      #saac-vacio {
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 12px; padding: 40px 20px;
        color: rgba(255,255,255,0.35); text-align: center;
      }
      #saac-vacio.visible { display: flex; }
      #saac-vacio span { font-size: 3rem; }
      #saac-vacio p { font-size: 0.9rem; font-weight: 600; }

      /* Panel historial */
      #saac-historial-panel {
        position: absolute; bottom: 0; left: 0; right: 0;
        background: rgba(15,8,36,0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 20px 20px 0 0;
        border-top: 1px solid rgba(255,255,255,0.12);
        padding: 16px; z-index: 50;
        transform: translateY(100%);
        transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
        max-height: 55%; overflow-y: auto;
      }
      #saac-historial-panel.visible { transform: translateY(0); }
      #saac-historial-panel h3 {
        font-size: 0.9rem; font-weight: 800;
        color: rgba(255,255,255,0.5);
        margin-bottom: 10px;
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .historial-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 4px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        cursor: pointer; border-radius: 8px;
        transition: background 0.15s;
      }
      .historial-item:active { background: rgba(255,255,255,0.06); }
      .historial-item .h-texto {
        flex: 1; font-size: 0.85rem; font-weight: 600;
        color: rgba(255,255,255,0.85);
      }
      .historial-item .h-btn {
        border: none; border-radius: 50%;
        width: 32px; height: 32px; color: white;
        font-size: 0.8rem; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
    </style>

    <div id="saac-wrap">
      <div id="saac-frase-bar">
        <button id="btn-saac-borrar"    class="saac-btn-accion" title="Borrar frase">&#10005;</button>
        <div    id="saac-frase-scroll"></div>
        <button id="btn-saac-historial" class="saac-btn-accion" title="Historial">&#128336;</button>
        <button id="btn-saac-hablar"    class="saac-btn-accion" title="Decir frase">&#128266;</button>
      </div>
      <nav id="saac-cats" aria-label="Categorias"></nav>
      <div id="saac-busqueda-wrap">
        <input id="saac-busqueda" type="search"
               placeholder="Busca un pictograma..."
               autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div id="saac-grid-wrap">
        <div id="saac-grid" class="tam-${_tamano}"></div>
        <div id="saac-vacio">
          <span>&#128269;</span>
          <p>No se encontraron pictogramas.<br>Prueba otra busqueda.</p>
        </div>
        <div id="saac-historial-panel">
          <h3>Frases recientes</h3>
          <div id="saac-historial-lista"></div>
        </div>
      </div>
    </div>
  `;

  _container.querySelector('#btn-saac-hablar').addEventListener('click', _hablarFrase);
  _container.querySelector('#btn-saac-borrar').addEventListener('click', _borrarFrase);
  _container.querySelector('#btn-saac-historial').addEventListener('click', _toggleHistorial);
  _container.querySelector('#saac-busqueda').addEventListener('input', e => {
    _busqueda = e.target.value;
    _renderGrid();
  });
  _container.querySelector('#saac-grid-wrap').addEventListener('click', _cerrarHistorial);
}

function _renderCategorias() {
  const nav = _container.querySelector('#saac-cats');
  nav.innerHTML = '';
  _datos.categorias.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'cat-chip' + (_catActiva === cat.id ? ' activa' : '');
    chip.style.background = cat.color;
    chip.style.color      = cat.colorTexto;
    chip.textContent      = cat.emoji + ' ' + cat.label;
    chip.dataset.id       = cat.id;
    chip.addEventListener('click', () => {
      _catActiva = cat.id;
      _busqueda  = '';
      _container.querySelector('#saac-busqueda').value = '';
      _renderCategorias();
      _renderGrid();
    });
    nav.appendChild(chip);
  });
}

function _renderGrid() {
  if (!_container) return;                            // guard
  const grid  = _container.querySelector('#saac-grid');
  const vacio = _container.querySelector('#saac-vacio');
  if (!grid || !vacio) return;
  grid.innerHTML = '';
  const normQ = _norm(_busqueda.trim());
  const items = _datos.vocabulario.filter(v => {
    if (normQ) return _norm(v.label).includes(normQ) || _norm(v.id).includes(normQ);
    if (_catActiva === 'favs') return _favs.has(v.id);
    return v.cat === _catActiva;
  });
  vacio.classList.toggle('visible', items.length === 0);
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'picto-card' + (_favs.has(item.id) ? ' es-fav' : '');
    const cat = _datos.categorias.find(c => c.id === item.cat);
    if (cat) { card.style.background = cat.color; card.style.color = cat.colorTexto; }
    card.innerHTML =
      '<span class="fav-dot">&#11088;</span>' +
      '<img src="' + PICS_BASE + item.id + '.png"' +
      ' onerror="this.style.opacity=\'0.2\';this.src=\'\'"' +
      ' alt="' + item.label + '">' +
      '<span class="picto-label">' + item.label + '</span>';
    card.addEventListener('click', () => _seleccionarPicto(item));
    let _lp;
    card.addEventListener('pointerdown', () => {
      _lp = setTimeout(() => {
        _lpActivo = null;
        if (!_container) return;                      // guard
        _toggleFav(item.id, item.label);
        card.classList.toggle('es-fav', _favs.has(item.id));
      }, LONGPRESS_MS);
      _lpActivo = _lp;
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
      card.addEventListener(ev, () => {
        clearTimeout(_lp);
        if (_lpActivo === _lp) _lpActivo = null;
      })
    );
    grid.appendChild(card);
  });
}

function _seleccionarPicto(item) {
  _frase.push(item);
  _renderFrase();
  TTS.speak(item.label, { lang: 'es-MX', pitch: 1.15, rate: 0.9 });
}

function _renderFrase() {
  const scroll = _container.querySelector('#saac-frase-scroll');
  scroll.innerHTML = '';
  _frase.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'frase-item';
    el.title     = 'Toca para borrar';
    el.innerHTML =
      '<img src="' + PICS_BASE + item.id + '.png"' +
      ' onerror="this.style.opacity=\'0.15\'"' +
      ' alt="' + item.label + '">' +
      '<span>' + item.label + '</span>';
    el.addEventListener('click', () => { _frase.splice(i, 1); _renderFrase(); });
    scroll.appendChild(el);
  });
  requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });
}

function _hablarFrase() {
  if (!_frase.length) return;
  const texto = _frase.map(i => i.label).join(' ');
  TTS.speak(texto, { lang: 'es-MX', pitch: 1.1, rate: 0.85 });
  _historial = [texto, ..._historial.filter(h => h !== texto)].slice(0, HISTORIAL_MAX);
  _guardarHistorial();
}

function _borrarFrase() {
  _frase = [];
  _renderFrase();
  TTS.stop();
}

function _toggleFav(id, label) {
  if (_favs.has(id)) {
    _favs.delete(id);
    toast(label + ' quitado de favoritos', { emoji: '&#128148;' });
  } else {
    _favs.add(id);
    toast(label + ' en favoritos', { emoji: '&#11088;' });
  }
  _guardarFavs();
  if (_catActiva === 'favs') _renderGrid();
}

function _toggleHistorial() {
  const panel = _container.querySelector('#saac-historial-panel');
  const abierto = panel.classList.toggle('visible');
  if (abierto) _renderHistorial();
}

function _cerrarHistorial() {
  _container.querySelector('#saac-historial-panel')?.classList.remove('visible');
}

function _renderHistorial() {
  const lista = _container.querySelector('#saac-historial-lista');
  lista.innerHTML = '';
  if (!_historial.length) {
    lista.innerHTML = '<p style="color:rgba(255,255,255,0.35);font-size:0.85rem;padding:8px 0;">Aun no hay frases guardadas.</p>';
    return;
  }
  _historial.forEach((texto, i) => {
    const item = document.createElement('div');
    item.className = 'historial-item';
    item.innerHTML =
      '<span class="h-texto">' + texto + '</span>' +
      '<button class="h-btn" style="background:#22c55e;" title="Repetir">&#128266;</button>' +
      '<button class="h-btn" style="background:#ef4444;" title="Eliminar">&#10005;</button>';
    item.querySelectorAll('.h-btn')[0].addEventListener('click', e => {
      e.stopPropagation();
      TTS.speak(texto, { lang: 'es-MX', pitch: 1.1, rate: 0.85 });
    });
    item.querySelectorAll('.h-btn')[1].addEventListener('click', e => {
      e.stopPropagation();
      _historial.splice(i, 1);
      _guardarHistorial();
      _renderHistorial();
    });
    lista.appendChild(item);
  });
  const btnBorrarTodo = document.createElement('button');
  btnBorrarTodo.textContent = 'Borrar todo';
  btnBorrarTodo.style.cssText =
    'margin-top:12px;width:100%;padding:10px;border-radius:12px;border:none;' +
    'background:rgba(239,68,68,0.2);color:#fca5a5;font-weight:800;' +
    'font-size:0.85rem;cursor:pointer;border:1px solid rgba(239,68,68,0.3);';
  btnBorrarTodo.addEventListener('click', () => {
    _historial = [];
    _guardarHistorial();
    _renderHistorial();
  });
  lista.appendChild(btnBorrarTodo);
}
