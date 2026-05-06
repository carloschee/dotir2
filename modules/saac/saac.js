/* Dotir 2 - modules/saac/saac.js */

import { TTS         } from '../../core/tts.js';
import { fetchTimeout } from '../../core/offline.js';
import { toast        } from '../../core/ui.js';

const DATA_URL     = './data/saac.json';
const PICS_BASE    = './assets/pics/';
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

export function destroy() {
  _frase     = [];
  _busqueda  = '';
  _catActiva = 'favs';
  _datos     = null;
  _container = null;
}

export function onEnter() {}
export function onLeave() { TTS.stop(); }

export function pause() {
  _container = null;
}

export async function resume(container) {
  _container = container;
  // Los datos ya estan en memoria — solo re-renderizar
  _renderShell();
  _renderCategorias();
  _renderGrid();
  // Restaurar frase si habia algo escrito
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

function _renderShell() {
  _container.innerHTML = `
    <style>
      #saac-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow: hidden;
        background: var(--d-bg, #F0F4FA);
      }

      #saac-frase-bar {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        background: var(--d-surface, white);
        border-bottom: 1px solid var(--d-border, rgba(0,0,0,0.08));
        flex-shrink: 0; min-height: 88px;
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
        padding: 4px; border-radius: 10px;
        transition: background 0.15s;
      }
      .frase-item:active { background: #fee2e2; }
      .frase-item img {
        width: 52px; height: 52px; object-fit: contain;
        border-radius: 8px; background: #f1f5f9;
      }
      .frase-item span {
        font-size: 0.6rem; font-weight: 700;
        color: #475569; max-width: 60px;
        text-align: center; line-height: 1.1;
      }

      .saac-btn-accion {
        flex-shrink: 0; width: 48px; height: 48px;
        border-radius: 14px; border: none;
        background: #f1f5f9; font-size: 1.2rem;
        cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        transition: background 0.15s, transform 0.1s;
      }
      .saac-btn-accion:active { background: #e2e8f0; transform: scale(0.93); }

      #saac-cats {
        display: flex; gap: 8px; overflow-x: auto;
        padding: 10px 12px; flex-shrink: 0;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        border-bottom: 1px solid var(--d-border, rgba(0,0,0,0.06));
        background: var(--d-surface, white);
      }
      #saac-cats::-webkit-scrollbar { display: none; }

      .cat-chip {
        flex-shrink: 0; padding: 7px 14px;
        border-radius: 20px; border: none;
        font-size: 0.82rem; font-weight: 800;
        cursor: pointer; white-space: nowrap;
        opacity: 0.55; transition: opacity 0.15s, transform 0.12s;
      }
      .cat-chip.activa { opacity: 1; transform: scale(1.05); }

      #saac-busqueda-wrap {
        padding: 8px 12px; flex-shrink: 0;
        background: var(--d-surface, white);
        border-bottom: 1px solid var(--d-border, rgba(0,0,0,0.06));
      }
      #saac-busqueda {
        width: 100%; padding: 10px 14px;
        border-radius: 14px; border: 1.5px solid #e2e8f0;
        font-size: 0.9rem; font-family: inherit;
        outline: none; background: #f8fafc;
        color: #1e293b;
      }
      #saac-busqueda:focus { border-color: #a855f7; }

      #saac-grid-wrap {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        padding: 10px 8px;
        -webkit-overflow-scrolling: touch;
        position: relative;
      }
      #saac-grid {
        display: grid; gap: 8px;
      }
      #saac-grid.tam-S { grid-template-columns: repeat(auto-fill, minmax(72px,  1fr)); }
      #saac-grid.tam-M { grid-template-columns: repeat(auto-fill, minmax(96px,  1fr)); }
      #saac-grid.tam-L { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }

      .picto-card {
        display: flex; flex-direction: column;
        align-items: center; gap: 4px;
        padding: 8px 4px; border-radius: 14px;
        cursor: pointer; position: relative;
        border: 2px solid transparent;
        transition: transform 0.12s, box-shadow 0.12s;
        user-select: none;
      }
      .picto-card:active { transform: scale(0.93); box-shadow: none; }
      .picto-card img {
        width: 100%; aspect-ratio: 1;
        object-fit: contain; border-radius: 8px;
      }
      .picto-label {
        font-size: 0.65rem; font-weight: 800;
        text-align: center; line-height: 1.1;
        max-width: 100%;
      }
      .fav-dot {
        position: absolute; top: 4px; right: 4px;
        font-size: 0.7rem; opacity: 0;
        transition: opacity 0.15s;
      }
      .picto-card.es-fav .fav-dot { opacity: 1; }

      #saac-vacio {
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 12px; padding: 40px 20px;
        color: #94a3b8; text-align: center;
      }
      #saac-vacio.visible { display: flex; }
      #saac-vacio span { font-size: 3rem; }
      #saac-vacio p { font-size: 0.9rem; font-weight: 600; }

      #saac-historial-panel {
        position: absolute; bottom: 0; left: 0; right: 0;
        background: white; border-radius: 20px 20px 0 0;
        padding: 16px; box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
        z-index: 50; transform: translateY(100%);
        transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
        max-height: 55%; overflow-y: auto;
      }
      #saac-historial-panel.visible { transform: translateY(0); }
      #saac-historial-panel h3 {
        font-size: 0.9rem; font-weight: 800; color: #475569;
        margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;
      }
      .historial-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 4px; border-bottom: 1px solid #f1f5f9;
        cursor: pointer; border-radius: 8px;
        transition: background 0.15s;
      }
      .historial-item:active { background: #f0f4fa; }
      .historial-item .h-texto {
        flex: 1; font-size: 0.85rem; font-weight: 600; color: #334155;
      }
      .historial-item .h-btn {
        border: none; border-radius: 50%;
        width: 32px; height: 32px; color: white; font-size: 0.8rem;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
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
  const grid  = _container.querySelector('#saac-grid');
  const vacio = _container.querySelector('#saac-vacio');
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
        _toggleFav(item.id, item.label);
        card.classList.toggle('es-fav', _favs.has(item.id));
      }, LONGPRESS_MS);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
      card.addEventListener(ev, () => clearTimeout(_lp))
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
    el.title     = 'Toca para borrar esta palabra';
    el.innerHTML =
      '<img src="' + PICS_BASE + item.id + '.png"' +
      ' onerror="this.style.opacity=\'0.15\'"' +
      ' alt="' + item.label + '">' +
      '<span>' + item.label + '</span>';
    el.addEventListener('click', () => {
      _frase.splice(i, 1);
      _renderFrase();
    });
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
    lista.innerHTML = '<p style="color:#94a3b8;font-size:0.85rem;padding:8px 0;">Aun no hay frases guardadas.</p>';
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
    'background:#fee2e2;color:#991b1b;font-weight:800;font-size:0.85rem;cursor:pointer;';
  btnBorrarTodo.addEventListener('click', () => {
    _historial = [];
    _guardarHistorial();
    _renderHistorial();
  });
  lista.appendChild(btnBorrarTodo);
}
