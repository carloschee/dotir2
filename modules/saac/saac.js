/* ============================================================
   Dótir 2 — modules/saac/saac.js
   Lógica completa del tablero de Comunicación Aumentativa.

   Mejoras sobre Dótir v1:
   · Datos desde saac.json (desacoplado del código)
   · Categoría "Emociones" separada de Social
   · Historial de frases (últimas 10, persistente)
   · Borrado de palabra individual al tocar en la barra de frase
   · Búsqueda normalizada (ignora tildes y mayúsculas)
   · Tamaño de pictograma configurable (S / M / L)
   · TTS desde core/tts.js compartido
   · Favoritos persistentes con localStorage
   · Long-press para toggle de favorito (sin menú contextual)
   ============================================================ */

import { TTS        } from '../../core/tts.js';
import { fetchTimeout } from '../../core/offline.js';
import { toast       } from '../../core/ui.js';

const DATA_URL    = './data/saac.json';
const PICS_BASE   = './assets/pics/';
const LS_FAVS     = 'dotir2-saac-favs';
const LS_HISTORIAL= 'dotir2-saac-historial';
const LS_TAMANO   = 'dotir2-saac-tamano';
const HISTORIAL_MAX = 10;
const LONGPRESS_MS  = 500;

// ── Estado interno ────────────────────────────────────────────
let _datos      = null;   // { categorias, vocabulario }
let _favs       = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || '[]'));
let _historial  = JSON.parse(localStorage.getItem(LS_HISTORIAL) || '[]');
let _frase      = [];     // Array de { id, label }
let _catActiva  = 'favs';
let _busqueda   = '';
let _tamano     = localStorage.getItem(LS_TAMANO) || 'M'; // S | M | L
let _container  = null;

// ── Persistencia helpers ──────────────────────────────────────
const _guardarFavs = () =>
  localStorage.setItem(LS_FAVS, JSON.stringify([..._favs]));

const _guardarHistorial = () =>
  localStorage.setItem(LS_HISTORIAL, JSON.stringify(_historial));

// ── Normalización para búsqueda ───────────────────────────────
const _norm = t =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ── Carga de datos ────────────────────────────────────────────
async function _cargarDatos() {
  if (_datos) return _datos;
  try {
    const res = await fetchTimeout(DATA_URL, 6000);
    if (!res.ok) throw new Error(`saac.json: ${res.status}`);
    _datos = await res.json();
  } catch (e) {
    console.error('[SAAC] Error al cargar datos:', e);
    _datos = { categorias: [], vocabulario: [] };
  }
  return _datos;
}

// ── Inicializar módulo ────────────────────────────────────────
export async function init(container) {
  _container = container;
  await _cargarDatos();
  _renderShell();
  _renderCategorias();
  _renderGrid();
}

export function destroy() {
  _frase    = [];
  _busqueda = '';
  _catActiva = 'favs';
  _container = null;
}

export function onEnter() { /* nada que hacer */ }
export function onLeave() { TTS.stop(); }

// ── Shell HTML ────────────────────────────────────────────────
function _renderShell() {
  _container.innerHTML = `
    <style>
      /* ── SAAC layout ──────────────────────────────── */
      #saac-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow: hidden;
        background: #F0F4FA;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      /* Barra de frase */
      #saac-frase-bar {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        background: white;
        border-bottom: 1px solid #e2e8f0;
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
        border-radius: 8px; pointer-events: none;
      }
      .frase-item span {
        font-size: 0.6rem; font-weight: 700;
        color: #64748b; text-align: center;
        max-width: 56px; line-height: 1.1;
        pointer-events: none;
      }

      /* Botones de acción de la frase */
      .saac-btn-accion {
        border: none; border-radius: 50%; color: white;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; flex-shrink: 0;
        font-size: 1.2rem; transition: transform 0.12s;
      }
      .saac-btn-accion:active { transform: scale(0.9); }
      #btn-saac-hablar {
        width: 58px; height: 58px; background: #22c55e; font-size: 1.5rem;
      }
      #btn-saac-borrar {
        width: 42px; height: 42px; background: #ef4444; font-size: 1rem;
      }
      #btn-saac-historial {
        width: 38px; height: 38px; background: #94a3b8; font-size: 0.9rem;
      }

      /* Barra de categorías */
      #saac-cats {
        display: flex; gap: 6px; overflow-x: auto;
        padding: 8px 12px; background: white;
        border-bottom: 1px solid #e2e8f0;
        flex-shrink: 0; -webkit-overflow-scrolling: touch;
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
        background: #f1f5f9; color: #475569;
      }
      .cat-chip.activa {
        border-color: currentColor;
        filter: brightness(0.92);
      }

      /* Barra de búsqueda */
      #saac-busqueda-wrap {
        padding: 8px 12px; background: #f8fafc;
        border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
      }
      #saac-busqueda {
        width: 100%; padding: 9px 16px;
        border-radius: 20px; border: 2px solid #e2e8f0;
        font-size: 0.88rem; background: white;
        outline: none; transition: border-color 0.2s;
      }
      #saac-busqueda:focus { border-color: #4A90E2; }

      /* Grid de pictogramas */
      #saac-grid-wrap {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        padding: 12px; -webkit-overflow-scrolling: touch;
      }
      #saac-grid {
        display: grid;
        gap: 10px;
      }
      #saac-grid.tam-S { grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); }
      #saac-grid.tam-M { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); }
      #saac-grid.tam-L { grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); }

      /* Tarjeta de pictograma */
      .picto-card {
        border-radius: 14px; padding: 10px 6px 8px;
        display: flex; flex-direction: column;
        align-items: center; gap: 6px;
        cursor: pointer; position: relative;
        border-bottom: 4px solid rgba(0,0,0,0.12);
        transition: transform 0.12s, box-shadow 0.12s;
        user-select: none; -webkit-user-select: none;
      }
      .picto-card:active { transform: scale(0.94); }
      .picto-card img {
        object-fit: contain; pointer-events: none;
        border-radius: 8px;
      }
      #saac-grid.tam-S .picto-card img { width: 58px;  height: 58px; }
      #saac-grid.tam-M .picto-card img { width: 78px;  height: 78px; }
      #saac-grid.tam-L .picto-card img { width: 100px; height: 100px; }

      .picto-card .picto-label {
        font-weight: 700; text-align: center; line-height: 1.15;
        pointer-events: none;
      }
      #saac-grid.tam-S .picto-label { font-size: 0.68rem; }
      #saac-grid.tam-M .picto-label { font-size: 0.75rem; }
      #saac-grid.tam-L .picto-label { font-size: 0.82rem; }

      .picto-card .fav-dot {
        position: absolute; top: 5px; right: 6px;
        font-size: 0.75rem; opacity: 0;
        transition: opacity 0.2s;
      }
      .picto-card.es-fav .fav-dot { opacity: 1; }

      /* Estado vacío */
      #saac-vacio {
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 12px; padding: 40px 20px;
        color: #94a3b8; text-align: center;
      }
      #saac-vacio.visible { display: flex; }
      #saac-vacio span { font-size: 3rem; }
      #saac-vacio p { font-size: 0.9rem; font-weight: 600; }

      /* Panel de historial */
      #saac-historial-panel {
        position: absolute; bottom: 0; left: 0; right: 0;
        background: white; border-radius: 20px 20px 0 0;
        padding: 16px; box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
        z-index: 50; transform: translateY(100%);
        transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
        max-height: 55%;
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
        background: #22c55e; border: none; border-radius: 50%;
        width: 32px; height: 32px; color: white; font-size: 0.8rem;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
      }
    </style>

    <div id="saac-wrap">

      <!-- Barra de frase ──────────────────────────── -->
      <div id="saac-frase-bar">
        <button id="btn-saac-borrar"    class="saac-btn-accion" title="Borrar frase">✕</button>
        <div    id="saac-frase-scroll"></div>
        <button id="btn-saac-historial" class="saac-btn-accion" title="Historial">🕐</button>
        <button id="btn-saac-hablar"    class="saac-btn-accion" title="Decir frase">🔊</button>
      </div>

      <!-- Categorías ─────────────────────────────── -->
      <nav id="saac-cats" aria-label="Categorías"></nav>

      <!-- Búsqueda ───────────────────────────────── -->
      <div id="saac-busqueda-wrap">
        <input id="saac-busqueda" type="search"
               placeholder="🔍  Busca un pictograma…"
               autocomplete="off" autocorrect="off" spellcheck="false">
      </div>

      <!-- Grid ───────────────────────────────────── -->
      <div id="saac-grid-wrap">
        <div id="saac-grid" class="tam-${_tamano}"></div>
        <div id="saac-vacio">
          <span>🔍</span>
          <p>No se encontraron pictogramas.<br>Prueba otra búsqueda.</p>
        </div>
      </div>

      <!-- Panel de historial ─────────────────────── -->
      <div id="saac-historial-panel">
        <h3>Frases recientes</h3>
        <div id="saac-historial-lista"></div>
      </div>

    </div>
  `;

  // ── Eventos ────────────────────────────────────────────────
  _container.querySelector('#btn-saac-hablar').addEventListener('click', _hablarFrase);
  _container.querySelector('#btn-saac-borrar').addEventListener('click', _borrarFrase);
  _container.querySelector('#btn-saac-historial').addEventListener('click', _toggleHistorial);

  _container.querySelector('#saac-busqueda').addEventListener('input', e => {
    _busqueda = e.target.value;
    _renderGrid();
  });

  // Cerrar historial al tocar fuera
  _container.querySelector('#saac-grid-wrap').addEventListener('click', _cerrarHistorial);
}

// ── Renderizar chips de categorías ────────────────────────────
function _renderCategorias() {
  const nav = _container.querySelector('#saac-cats');
  nav.innerHTML = '';

  _datos.categorias.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = `cat-chip${_catActiva === cat.id ? ' activa' : ''}`;
    chip.style.background  = cat.color;
    chip.style.color       = cat.colorTexto;
    chip.textContent       = `${cat.emoji} ${cat.label}`;
    chip.dataset.id        = cat.id;
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

// ── Renderizar grid de pictogramas ────────────────────────────
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

  // Estado vacío
  vacio.classList.toggle('visible', items.length === 0);

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = `picto-card${_favs.has(item.id) ? ' es-fav' : ''}`;

    // Color de categoría
    const cat = _datos.categorias.find(c => c.id === item.cat);
    if (cat) {
      card.style.background = cat.color;
      card.style.color      = cat.colorTexto;
    }

    const imgSrc = `${PICS_BASE}${item.id}.png`;
    card.innerHTML = `
      <span class="fav-dot">⭐</span>
      <img src="${imgSrc}"
           onerror="this.style.opacity='0.2';this.src=''"
           alt="${item.label}">
      <span class="picto-label">${item.label}</span>
    `;

    // Toque corto → añadir a frase + TTS
    card.addEventListener('click', () => _seleccionarPicto(item));

    // Long press → toggle favorito
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

// ── Seleccionar pictograma ────────────────────────────────────
function _seleccionarPicto(item) {
  _frase.push(item);
  _renderFrase();
  TTS.speak(item.label, { lang: 'es-MX', pitch: 1.15, rate: 0.9 });
}

// ── Renderizar barra de frase ─────────────────────────────────
function _renderFrase() {
  const scroll = _container.querySelector('#saac-frase-scroll');
  scroll.innerHTML = '';

  _frase.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'frase-item';
    el.title     = 'Toca para borrar esta palabra';
    el.innerHTML = `
      <img src="${PICS_BASE}${item.id}.png"
           onerror="this.style.opacity='0.15'"
           alt="${item.label}">
      <span>${item.label}</span>
    `;
    el.addEventListener('click', () => {
      _frase.splice(i, 1);
      _renderFrase();
    });
    scroll.appendChild(el);
  });

  // Auto-scroll al final
  requestAnimationFrame(() => {
    scroll.scrollLeft = scroll.scrollWidth;
  });
}

// ── Hablar frase completa ─────────────────────────────────────
function _hablarFrase() {
  if (!_frase.length) return;
  const texto = _frase.map(i => i.label).join(' ');
  TTS.speak(texto, { lang: 'es-MX', pitch: 1.1, rate: 0.85 });

  // Guardar en historial
  _historial = [texto, ..._historial.filter(h => h !== texto)].slice(0, HISTORIAL_MAX);
  _guardarHistorial();
}

// ── Borrar frase ──────────────────────────────────────────────
function _borrarFrase() {
  _frase = [];
  _renderFrase();
  TTS.stop();
}

// ── Toggle favorito ───────────────────────────────────────────
function _toggleFav(id, label) {
  if (_favs.has(id)) {
    _favs.delete(id);
    toast(`${label} quitado de favoritos`, { emoji: '💔' });
  } else {
    _favs.add(id);
    toast(`${label} añadido a favoritos`, { emoji: '⭐' });
  }
  _guardarFavs();
  // Si estamos en favoritos, re-renderizar para mostrar cambio
  if (_catActiva === 'favs') _renderGrid();
}

// ── Historial ─────────────────────────────────────────────────
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
    lista.innerHTML = '<p style="color:#94a3b8;font-size:0.85rem;padding:8px 0;">Aún no hay frases guardadas.</p>';
    return;
  }

  _historial.forEach(texto => {
    const item = document.createElement('div');
    item.className = 'historial-item';
    item.innerHTML = `
      <span class="h-texto">${texto}</span>
      <button class="h-btn" title="Repetir">🔊</button>
    `;
    item.querySelector('.h-btn').addEventListener('click', e => {
      e.stopPropagation();
      TTS.speak(texto, { lang: 'es-MX', pitch: 1.1, rate: 0.85 });
    });
    lista.appendChild(item);
  });
}

// ── API para ajustes externos (tamaño de pictograma) ──────────
export function setTamano(t) {
  if (!['S','M','L'].includes(t)) return;
  _tamano = t;
  localStorage.setItem(LS_TAMANO, t);
  const grid = _container?.querySelector('#saac-grid');
  if (grid) {
    grid.classList.remove('tam-S','tam-M','tam-L');
    grid.classList.add(`tam-${t}`);
  }
}

export function getTamano() { return _tamano; }
