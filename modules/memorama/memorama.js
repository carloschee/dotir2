/* ============================================================
   Dótir 2 — modules/memorama/memorama.js
   Juego de memoria con pictogramas multiidioma.

   Mejoras sobre DJ Emmy:
   · Completamente modular — sin dependencias globales
   · TTS desde core/tts.js compartido
   · Confeti desde core/ui.js compartido
   · Selector de dificultad: Fácil (6p) / Normal (10p) / Difícil (12p)
   · Contador de intentos y tiempo de partida
   · Pila de pares encontrados con nombre en idioma activo
   · Grid responsive puro CSS (sin Tailwind)
   · Dorsos SVG por tema (heredados de DJ Emmy, refinados)
   · Intro animada con imágenes flotando al elegir tema
   ============================================================ */

import { TTS         } from '../../core/tts.js';
import { lanzarConfeti, toast } from '../../core/ui.js';
import { fetchTimeout } from '../../core/offline.js';

const TEMAS_URL  = './data/memorama-temas.json';
const PICS_BASE  = './';          // las rutas carpeta_img ya son relativas a la raíz

const DIFICULTAD = {
  facil:  { pares: 6,  label: 'Fácil',  cols: 4 },
  normal: { pares: 10, label: 'Normal', cols: 5 },
  dificil:{ pares: 12, label: 'Difícil',cols: 6 },
};

const IDIOMAS = [
  { id: 'es-MX', bandera: '🇲🇽', lang: 'es-MX' },
  { id: 'en-US', bandera: '🇺🇸', lang: 'en-US' },
  { id: 'fr-FR', bandera: '🇫🇷', lang: 'fr-FR' },
  { id: 'zh-CN', bandera: '🇨🇳', lang: 'zh-CN' },
];

const LS_IDIOMAS    = 'dotir2-mem-idiomas';
const LS_DIFICULTAD = 'dotir2-mem-dificultad';

// Dorsos SVG por tema
const DORSOS = {
  frutas: {
    bg: 'linear-gradient(145deg,#1a4731 0%,#2d6a4f 40%,#52b788 100%)',
    svg: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
      <circle cx="15" cy="20" r="18" fill="rgba(255,255,255,0.08)"/>
      <circle cx="65" cy="90" r="22" fill="rgba(255,255,255,0.08)"/>
      <circle cx="70" cy="25" r="10" fill="rgba(255,255,255,0.10)"/>
      <circle cx="10" cy="95" r="12" fill="rgba(255,255,255,0.07)"/>
      <circle cx="40" cy="60" r="28" fill="rgba(255,255,255,0.05)"/>
    </svg>`,
  },
  transportes: {
    bg: 'linear-gradient(160deg,#03045e 0%,#0077b6 55%,#00b4d8 100%)',
    svg: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
      <line x1="0" y1="30" x2="80" y2="30" stroke="rgba(255,255,255,0.10)" stroke-width="8"/>
      <line x1="0" y1="60" x2="80" y2="60" stroke="rgba(255,255,255,0.07)" stroke-width="5"/>
      <line x1="0" y1="90" x2="80" y2="90" stroke="rgba(255,255,255,0.10)" stroke-width="8"/>
      <polygon points="60,5 80,30 80,5" fill="rgba(255,200,0,0.20)"/>
      <polygon points="0,90 20,120 0,120" fill="rgba(255,200,0,0.15)"/>
    </svg>`,
  },
  vegetales: {
    bg: 'linear-gradient(145deg,#3d2b1f 0%,#6b4c2a 45%,#a3793a 100%)',
    svg: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
      <ellipse cx="40" cy="115" rx="35" ry="18" fill="rgba(0,0,0,0.10)"/>
      <path d="M40 100 Q20 70 25 40 Q40 10 55 40 Q60 70 40 100Z" fill="rgba(255,255,255,0.08)"/>
      <path d="M40 100 Q55 75 50 50" stroke="rgba(255,255,255,0.15)" stroke-width="2" fill="none"/>
    </svg>`,
  },
  default: {
    bg: 'linear-gradient(135deg,#2d1b69 0%,#6a0dad 55%,#c0147a 100%)',
    svg: `<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
      <polygon points="40,5 75,30 62,70 18,70 5,30" fill="rgba(255,255,255,0.06)"/>
      <circle cx="40" cy="60" r="15" fill="rgba(255,255,255,0.07)"/>
      <circle cx="65" cy="15" r="16" fill="rgba(255,255,255,0.05)"/>
    </svg>`,
  },
};

// ── Estado interno ────────────────────────────────────────────
let _container    = null;
let _temas        = [];
let _temaActivo   = null;      // objeto completo del tema
let _itemMap      = {};        // id → item
let _cartas       = [];        // array de { id, itemId, volteada, encontrada }
let _volteadas    = [];        // máximo 2 cartas en juego
let _bloqueado    = false;
let _parejas      = 0;
let _intentos     = 0;
let _timerInterval= null;
let _segundos     = 0;

let _idiomasActivos = new Set(
  JSON.parse(localStorage.getItem(LS_IDIOMAS) || '["es-MX"]')
);
let _dificultad = localStorage.getItem(LS_DIFICULTAD) || 'normal';

// ── Utilidades ────────────────────────────────────────────────
const _idiomaAleatorio = () => {
  const arr = [..._idiomasActivos];
  return arr[Math.floor(Math.random() * arr.length)];
};

const _nombreItem = (item, idioma) =>
  item[idioma] || item['es-MX'] || String(item.id);

const _dorso = (temaId) => DORSOS[temaId] || DORSOS.default;

// ── Carga de temas ────────────────────────────────────────────
async function _cargarTemas() {
  if (_temas.length) return _temas;
  try {
    const res = await fetchTimeout(TEMAS_URL, 6000);
    if (!res.ok) throw new Error(`memorama-temas.json: ${res.status}`);
    _temas = await res.json();
  } catch (e) {
    console.error('[Memorama] Error al cargar temas:', e);
    _temas = [];
  }
  return _temas;
}

async function _cargarTema(meta) {
  const res = await fetchTimeout(`./${meta.archivo}`, 6000);
  if (!res.ok) throw new Error(`${meta.archivo}: ${res.status}`);
  return res.json();
}

// ── Inicializar módulo ────────────────────────────────────────
export async function init(container) {
  _container = container;
  await _cargarTemas();
  _renderShell();
  _renderNavAcciones();   // inyecta controles en la navbar del shell
  _mostrarModalTemas();
}

export function destroy() {
  _detenerTimer();
  _cartas     = [];
  _volteadas  = [];
  _temaActivo = null;
  _container  = null;
  // Limpiar acciones inyectadas en la navbar del shell
  const acc = document.getElementById('modulo-acciones');
  if (acc) acc.innerHTML = '';
}

export function onEnter() {}
export function onLeave() { TTS.stop(); _detenerTimer(); }

// ── Inyectar controles en la navbar del shell ─────────────────
// Los módulos exponen sus controles en #modulo-acciones para
// mantener el lenguaje visual unificado de la navbar.
function _renderNavAcciones() {
  const acc = document.getElementById('modulo-acciones');
  if (!acc) return;
  acc.innerHTML = '';

  // Stats compactos
  const stats = document.createElement('div');
  stats.id = 'mem-stats-nav';
  stats.style.cssText = 'display:flex;gap:10px;align-items:center;';
  stats.innerHTML = `
    <span class="mem-stat-nav" id="nav-stat-pares"   title="Pares">🃏 <strong>0</strong></span>
    <span class="mem-stat-nav" id="nav-stat-intentos" title="Intentos">🔁 <strong>0</strong></span>
    <span class="mem-stat-nav" id="nav-stat-tiempo"   title="Tiempo">⏱ <strong>0:00</strong></span>
  `;

  // Selector de idiomas
  const langsWrap = document.createElement('div');
  langsWrap.style.cssText = 'display:flex;gap:4px;';
  IDIOMAS.forEach(({ id, bandera }) => {
    const btn = document.createElement('button');
    btn.className = `d-lang-btn${_idiomasActivos.has(id) ? ' activo' : ''}`;
    btn.textContent = bandera;
    btn.dataset.lang = id;
    btn.addEventListener('click', () => {
      if (_idiomasActivos.has(id) && _idiomasActivos.size <= 1) return;
      _idiomasActivos.has(id) ? _idiomasActivos.delete(id) : _idiomasActivos.add(id);
      localStorage.setItem(LS_IDIOMAS, JSON.stringify([..._idiomasActivos]));
      btn.classList.toggle('activo', _idiomasActivos.has(id));
    });
    langsWrap.appendChild(btn);
  });

  // Botón nuevo juego
  const btnNuevo = document.createElement('button');
  btnNuevo.className = 'd-nav-btn';
  btnNuevo.textContent = '🔄';
  btnNuevo.title = 'Nueva partida';
  btnNuevo.addEventListener('click', () => { if (_temaActivo) _iniciarJuego(); });

  // Botón elegir tema
  const btnTema = document.createElement('button');
  btnTema.className = 'd-nav-btn';
  btnTema.textContent = '🎴 Tema';
  btnTema.addEventListener('click', _mostrarModalTemas);

  acc.append(stats, langsWrap, btnNuevo, btnTema);

  // Inyectar CSS de stats en el head (una sola vez)
  if (!document.getElementById('mem-nav-style')) {
    const s = document.createElement('style');
    s.id = 'mem-nav-style';
    s.textContent = `
      .mem-stat-nav {
        display:flex; align-items:center; gap:4px;
        color:rgba(255,255,255,0.55); font-size:0.72rem; font-weight:700;
      }
      .mem-stat-nav strong { color:white; font-size:0.85rem; }
    `;
    document.head.appendChild(s);
  }
}

// ── Shell HTML ────────────────────────────────────────────────
function _renderShell() {
  _container.innerHTML = `
    <style>
      #mem-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow: hidden;
        background: #1a1a2e; position: relative;
      }

      /* ── Grid de cartas ── */
      #mem-grid-wrap {
        flex:1; min-height:0; overflow-y:auto;
        padding:10px 10px 4px;
        display:flex; flex-direction:column; gap:8px;
      }
      #mem-grid {
        display:grid; gap:8px;
        /* cols se asignan inline según dificultad */
      }

      /* Carta */
      .mem-celda { aspect-ratio: 3/4; perspective: 600px; }
      .mem-carta {
        width:100%; height:100%;
        position:relative; cursor:pointer;
        transform-style: preserve-3d;
        transition: transform .5s cubic-bezier(.4,.2,.2,1);
      }
      .mem-carta.volteada { transform: rotateY(180deg); }
      .mem-carta.encontrada { cursor:default; opacity:.75; }

      .mem-cara {
        position:absolute; inset:0; border-radius:10px;
        backface-visibility:hidden; -webkit-backface-visibility:hidden;
        overflow:hidden;
        display:flex; align-items:center; justify-content:center;
      }
      .mem-dorso {
        border:2px solid rgba(255,255,255,0.4);
        box-shadow:0 4px 14px rgba(0,0,0,0.35);
      }
      .mem-frente {
        transform:rotateY(180deg);
        background:white;
        flex-direction:column; gap:4px; padding:6px;
        box-shadow:0 4px 14px rgba(0,0,0,0.25);
      }
      .mem-frente img {
        width:75%; height:70%;
        object-fit:contain; pointer-events:none;
      }
      .mem-frente .mem-label {
        font-size:clamp(.55rem,.9vw,.75rem);
        font-weight:800; text-align:center;
        color:#1a1a2e; line-height:1.1;
        pointer-events:none;
      }

      /* Animación de entrada */
      @keyframes mem-pop {
        from { opacity:0; transform:scale(.7); }
        to   { opacity:1; transform:scale(1); }
      }
      .mem-celda { animation: mem-pop .35s cubic-bezier(.34,1.56,.64,1) both; }

      /* ── Pila de pares ── */
      #mem-pila-wrap {
        flex-shrink:0; padding:6px 10px 8px;
        background:rgba(0,0,0,0.2);
        border-top:1px solid rgba(255,255,255,0.08);
        min-height:52px;
      }
      #mem-pila-label {
        font-size:.6rem; font-weight:800; color:rgba(255,255,255,.4);
        text-transform:uppercase; letter-spacing:.07em; margin-bottom:4px;
      }
      #mem-pila {
        display:flex; flex-wrap:wrap; gap:4px; align-items:center;
      }
      .mem-par-chip {
        background:rgba(255,255,255,0.12); border-radius:20px;
        padding:3px 10px; font-size:.7rem; font-weight:700;
        color:white; display:flex; align-items:center; gap:5px;
        animation: mem-pop .3s ease both;
      }
      .mem-par-chip img { width:18px; height:18px; object-fit:contain; }

      /* ── Modal de temas ── */
      #mem-modal {
        position:absolute; inset:0; z-index:40;
        background:rgba(10,10,30,0.85);
        display:flex; align-items:center; justify-content:center;
        backdrop-filter:blur(6px);
      }
      #mem-modal.oculto { display:none; }

      #mem-modal-box {
        background:#1e1e3a; border-radius:24px;
        padding:24px; width:90%; max-width:360px;
        border:1px solid rgba(255,255,255,0.15);
        box-shadow:0 20px 60px rgba(0,0,0,0.5);
        display:flex; flex-direction:column; gap:14px;
        max-height:85vh; overflow-y:auto;
      }
      #mem-modal-box h2 {
        color:white; font-size:1.1rem; font-weight:900;
        text-align:center; margin:0;
      }

      /* Dificultad */
      #mem-dif-btns { display:flex; gap:8px; justify-content:center; }
      .mem-dif-btn {
        flex:1; padding:8px 4px; border-radius:12px;
        border:2px solid rgba(255,255,255,0.2);
        background:rgba(255,255,255,0.08); color:white;
        font-weight:700; font-size:.78rem; cursor:pointer;
        transition:all .15s;
      }
      .mem-dif-btn.activo {
        border-color:#7B61FF; background:#7B61FF33; color:#c4b5fd;
      }

      /* Lista de temas */
      .mem-tema-btn {
        width:100%; display:flex; align-items:center; gap:12px;
        padding:12px 14px; border-radius:16px;
        border:1px solid rgba(255,255,255,0.1);
        background:rgba(255,255,255,0.06); color:white;
        cursor:pointer; text-align:left; transition:background .15s;
      }
      .mem-tema-btn:active { background:rgba(255,255,255,0.14); }
      .mem-tema-btn .mt-emoji { font-size:1.8rem; }
      .mem-tema-btn .mt-info { flex:1; }
      .mem-tema-btn .mt-titulo { font-weight:800; font-size:.9rem; }
      .mem-tema-btn .mt-items  { font-size:.7rem; color:rgba(255,255,255,.45); }

      /* ── Intro animada ── */
      #mem-intro {
        position:absolute; inset:0; z-index:30;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:16px;
        background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);
      }
      #mem-intro.oculto { display:none; }
      #mem-intro-titulo {
        color:white; font-size:1.5rem; font-weight:900;
        text-shadow:0 2px 12px rgba(0,0,0,.5);
      }
      #mem-intro-elementos {
        display:flex; flex-wrap:wrap;
        justify-content:center; gap:10px;
        max-width:340px; padding:0 16px;
      }
      @keyframes mem-flotar {
        0%,100% { transform:translateY(0) rotate(0deg); }
        33%      { transform:translateY(-12px) rotate(3deg); }
        66%      { transform:translateY(-6px) rotate(-2deg); }
      }
      .mem-flotar { animation: mem-flotar 2.4s ease-in-out infinite; }

      /* ── Victoria ── */
      #mem-victoria {
        position:absolute; inset:0; z-index:50;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:12px;
        pointer-events:none;
        transition:opacity .6s ease;
      }
      #mem-victoria.oculto { opacity:0; pointer-events:none; }
      #mem-trofeo {
        font-size:5rem;
        transition:transform .5s cubic-bezier(.175,.885,.32,1.275), opacity .5s;
        transform:scale(0); opacity:0;
      }
      #mem-victoria-label {
        color:white; font-size:1.1rem; font-weight:900;
        text-shadow:0 2px 12px rgba(0,0,0,.6);
      }
      #mem-victoria-stats {
        color:rgba(255,255,255,.7); font-size:.85rem; font-weight:600;
        text-align:center; line-height:1.6;
      }
    </style>

    <div id="mem-wrap">

      <!-- Grid — ocupa todo el espacio disponible bajo la navbar del shell -->
      <div id="mem-grid-wrap">
        <div id="mem-grid"></div>
      </div>

      <!-- Pila de pares encontrados -->
      <div id="mem-pila-wrap">
        <div id="mem-pila-label">Pares encontrados</div>
        <div id="mem-pila"></div>
      </div>

      <!-- Intro animada -->
      <div id="mem-intro" class="oculto">
        <p id="mem-intro-titulo"></p>
        <div id="mem-intro-elementos"></div>
      </div>

      <!-- Victoria -->
      <div id="mem-victoria" class="oculto">
        <span id="mem-trofeo">🏆</span>
        <p id="mem-victoria-label">¡Completado!</p>
        <p id="mem-victoria-stats"></p>
      </div>

      <!-- Modal de temas -->
      <div id="mem-modal">
        <div id="mem-modal-box">
          <h2>🎴 Elige un tema</h2>

          <!-- Dificultad -->
          <div id="mem-dif-btns">
            ${Object.entries(DIFICULTAD).map(([k,v]) =>
              `<button class="mem-dif-btn${_dificultad===k?' activo':''}"
                data-dif="${k}">${v.label}<br><small>${v.pares} pares</small></button>`
            ).join('')}
          </div>

          <!-- Lista de temas -->
          <div id="mem-lista-temas"></div>
        </div>
      </div>

    </div>
  `;

  // ── Eventos del shell (ya no hay topbar interna) ──────────
  _renderListaTemas();
}

// ── Helpers DOM ───────────────────────────────────────────────
const _q  = sel => _container.querySelector(sel);
const _qq = sel => _container.querySelectorAll(sel);

// ── Idiomas ───────────────────────────────────────────────────
function _renderIdiomas() {
  const wrap = _q('#mem-idiomas');
  wrap.innerHTML = '';
  IDIOMAS.forEach(({ id, bandera }) => {
    const btn = document.createElement('button');
    btn.className = `mem-lang-btn${_idiomasActivos.has(id) ? ' activo' : ''}`;
    btn.textContent = bandera;
    btn.dataset.lang = id;
    btn.addEventListener('click', () => {
      if (_idiomasActivos.has(id) && _idiomasActivos.size <= 1) return;
      _idiomasActivos.has(id) ? _idiomasActivos.delete(id) : _idiomasActivos.add(id);
      localStorage.setItem(LS_IDIOMAS, JSON.stringify([..._idiomasActivos]));
      btn.classList.toggle('activo', _idiomasActivos.has(id));
    });
    wrap.appendChild(btn);
  });
}

// ── Modal de temas ────────────────────────────────────────────
function _mostrarModalTemas() {
  _q('#mem-modal').classList.remove('oculto');
}

function _cerrarModal() {
  _q('#mem-modal').classList.add('oculto');
}

const TEMA_EMOJIS = { frutas:'🍎', transportes:'🚗', vegetales:'🥦' };

function _renderListaTemas() {
  const lista = _q('#mem-lista-temas');
  lista.innerHTML = '';

  if (!_temas.length) {
    lista.innerHTML = '<p style="color:rgba(255,255,255,.4);text-align:center;font-size:.85rem;">No se encontraron temas.</p>';
    return;
  }

  _temas.forEach(meta => {
    const emoji = TEMA_EMOJIS[meta.id] || '🎴';
    const btn = document.createElement('button');
    btn.className = 'mem-tema-btn';
    btn.innerHTML = `
      <span class="mt-emoji">${emoji}</span>
      <div class="mt-info">
        <div class="mt-titulo">${meta.titulo}</div>
        <div class="mt-items">${meta.items ?? ''} elementos</div>
      </div>
      <span style="color:rgba(255,255,255,.3);font-size:1.2rem">›</span>
    `;
    btn.addEventListener('click', async () => {
      _cerrarModal();
      await _activarTema(meta);
    });
    lista.appendChild(btn);
  });
}

// ── Activar tema ──────────────────────────────────────────────
async function _activarTema(meta) {
  try {
    const datos = await _cargarTema(meta);
    _temaActivo = datos;
    _itemMap    = {};
    datos.items.forEach(item => { _itemMap[item.id] = item; });

    // Actualizar topbar
    const emoji = TEMA_EMOJIS[datos.id] || '🎴';
    _q('#mem-tema-emoji').textContent  = emoji;
    _q('#mem-tema-nombre').textContent = datos.titulo;

    // TTS del nombre del tema
    TTS.speak(datos.titulo, { lang:'es-MX', pitch:1.2, rate:.95 });

    _mostrarIntro();
  } catch (e) {
    console.error('[Memorama] Error al cargar tema:', e);
    toast('Error al cargar el tema', { emoji:'❌' });
  }
}

// ── Intro animada ─────────────────────────────────────────────
function _mostrarIntro() {
  if (!_temaActivo) return;
  const intro    = _q('#mem-intro');
  const elementos= _q('#mem-intro-elementos');
  const titulo   = _q('#mem-intro-titulo');

  titulo.textContent = _temaActivo.titulo;
  elementos.innerHTML = '';

  _temaActivo.items.forEach((item, i) => {
    const imgUrl = _temaActivo.carpeta_img ? `${PICS_BASE}${_temaActivo.carpeta_img}${item.imagen}` : null;
    if (!imgUrl) return;
    const el = document.createElement('div');
    el.className = 'mem-flotar';
    el.style.animationDelay    = `${(i % 8) * 0.18}s`;
    el.style.animationDuration = `${2.2 + (i % 4) * 0.3}s`;
    const img = document.createElement('img');
    img.src    = imgUrl;
    img.alt    = item['es-MX'] || '';
    img.style.cssText = 'width:52px;height:52px;object-fit:contain;border-radius:8px;';
    img.onerror = () => el.remove();
    el.appendChild(img);
    elementos.appendChild(el);
  });

  intro.classList.remove('oculto');

  // Iniciar juego tras 2 segundos
  setTimeout(() => {
    intro.classList.add('oculto');
    _iniciarJuego();
  }, 2200);
}

// ── Iniciar juego ─────────────────────────────────────────────
function _iniciarJuego() {
  if (!_temaActivo) return;

  _detenerTimer();
  _cartas    = [];
  _volteadas = [];
  _bloqueado = false;
  _parejas   = 0;
  _intentos  = 0;
  _segundos  = 0;

  _actualizarStats();

  const cfg    = DIFICULTAD[_dificultad] || DIFICULTAD.normal;
  const MAX    = cfg.pares;
  const items  = [..._temaActivo.items]
    .sort(() => Math.random() - 0.5)
    .slice(0, MAX);

  _cartas = [...items, ...items]
    .sort(() => Math.random() - 0.5)
    .map((item, idx) => ({ idx, itemId: item.id, volteada: false, encontrada: false }));

  _renderGrid(cfg.cols);
  _iniciarTimer();

  // Limpiar pila y victoria
  _q('#mem-pila').innerHTML = '';
  const vict = _q('#mem-victoria');
  vict.classList.add('oculto');
  vict.style.opacity = '';
  const trofeo = _q('#mem-trofeo');
  trofeo.style.transform = 'scale(0)';
  trofeo.style.opacity   = '0';
}

// ── Render del tablero ────────────────────────────────────────
function _renderGrid(cols) {
  const grid = _q('#mem-grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const dorso = _dorso(_temaActivo?.id);

  _cartas.forEach((carta, i) => {
    const item   = _itemMap[carta.itemId];
    const imgUrl = (_temaActivo.carpeta_img && item?.imagen)
      ? `${PICS_BASE}${_temaActivo.carpeta_img}${item.imagen}` : null;
    const nombre = item ? _nombreItem(item, 'es-MX') : String(carta.itemId);

    const celda = document.createElement('div');
    celda.className = 'mem-celda';
    celda.style.animationDelay = `${i * 0.03}s`;

    celda.innerHTML = `
      <div class="mem-carta" data-idx="${i}">
        <div class="mem-cara mem-dorso" style="background:${dorso.bg}">
          ${dorso.svg}
        </div>
        <div class="mem-cara mem-frente">
          ${imgUrl
            ? `<img src="${imgUrl}" alt="${nombre}" onerror="this.style.opacity='.2'">`
            : `<span style="font-size:1.8rem">${nombre}</span>`}
          <span class="mem-label">${nombre}</span>
        </div>
      </div>
    `;

    celda.querySelector('.mem-carta').addEventListener('click', () => _voltear(i));
    grid.appendChild(celda);
  });
}

// ── Voltear carta ─────────────────────────────────────────────
function _voltear(idx) {
  const carta = _cartas[idx];
  if (_bloqueado || carta.volteada || carta.encontrada) return;

  carta.volteada = true;
  const el = _q(`[data-idx="${idx}"]`);
  el.classList.add('volteada');

  _volteadas.push(idx);

  if (_volteadas.length < 2) return;

  _intentos++;
  _actualizarStats();
  _bloqueado = true;

  const [a, b] = _volteadas;
  if (_cartas[a].itemId === _cartas[b].itemId) {
    // ¡Par encontrado!
    _cartas[a].encontrada = _cartas[b].encontrada = true;
    _q(`[data-idx="${a}"]`).classList.add('encontrada');
    _q(`[data-idx="${b}"]`).classList.add('encontrada');
    _parejas++;
    _actualizarStats();
    _volteadas = [];
    _bloqueado = false;

    // TTS en idioma aleatorio
    const item   = _itemMap[_cartas[a].itemId];
    const idioma = _idiomaAleatorio();
    const nombre = _nombreItem(item, idioma);
    const langObj = IDIOMAS.find(l => l.id === idioma);
    TTS.speak(nombre, { lang: langObj?.lang || 'es-MX', pitch:1.2, rate:.9, delay:150 });

    // Añadir chip a la pila
    _agregarPila(_cartas[a].itemId);

    if (_parejas === _cartas.length / 2) {
      setTimeout(_victoria, 600);
    }
  } else {
    // No coinciden → voltear de vuelta
    setTimeout(() => {
      _q(`[data-idx="${a}"]`).classList.remove('volteada');
      _q(`[data-idx="${b}"]`).classList.remove('volteada');
      _cartas[a].volteada = _cartas[b].volteada = false;
      _volteadas = [];
      _bloqueado = false;
    }, 1000);
  }
}

// ── Pila de pares ─────────────────────────────────────────────
function _agregarPila(itemId) {
  const item   = _itemMap[itemId];
  const idioma = _idiomaAleatorio();
  const nombre = _nombreItem(item, idioma);
  const imgUrl = (_temaActivo.carpeta_img && item?.imagen)
    ? `${PICS_BASE}${_temaActivo.carpeta_img}${item.imagen}` : null;

  const chip = document.createElement('div');
  chip.className = 'mem-par-chip';
  chip.innerHTML = imgUrl
    ? `<img src="${imgUrl}" alt="${nombre}">${nombre}`
    : nombre;
  _q('#mem-pila').appendChild(chip);
}

// ── Victoria ──────────────────────────────────────────────────
function _victoria() {
  _detenerTimer();

  lanzarConfeti({ container: _q('#mem-wrap') });
  TTS.speak('¡Muy bien!', { lang:'es-MX', pitch:1.3, rate:.9 });

  const mins   = Math.floor(_segundos / 60);
  const segs   = _segundos % 60;
  const tiempo = `${mins}:${String(segs).padStart(2,'0')}`;

  const vict   = _q('#mem-victoria');
  const trofeo = _q('#mem-trofeo');
  const stats  = _q('#mem-victoria-stats');

  stats.textContent = `${_parejas} pares · ${_intentos} intentos · ${tiempo}`;
  vict.classList.remove('oculto');
  vict.style.opacity = '1';

  requestAnimationFrame(() => {
    trofeo.style.transform = 'scale(1)';
    trofeo.style.opacity   = '1';
  });

  // Tras 3 segundos volver al modal de temas
  setTimeout(() => {
    vict.style.opacity = '0';
    setTimeout(() => {
      vict.classList.add('oculto');
      vict.style.opacity = '';
      trofeo.style.transform = 'scale(0)';
      trofeo.style.opacity   = '0';
      _mostrarModalTemas();
    }, 600);
  }, 3200);
}

// ── Timer ─────────────────────────────────────────────────────
function _iniciarTimer() {
  _timerInterval = setInterval(() => {
    _segundos++;
    const m = Math.floor(_segundos / 60);
    const s = _segundos % 60;
    const el = _q('#mem-stat-tiempo');
    if (el) el.textContent = `${m}:${String(s).padStart(2,'0')}`;
  }, 1000);
}

function _detenerTimer() {
  clearInterval(_timerInterval);
  _timerInterval = null;
}

// ── Stats ─────────────────────────────────────────────────────
function _actualizarStats() {
  const elP = _q('#mem-stat-pares');
  const elI = _q('#mem-stat-intentos');
  if (elP) elP.textContent = _parejas;
  if (elI) elI.textContent = _intentos;
}
