import { fetchTimeout } from '../../core/offline.js';

const DATA_URL   = './data/libros.json';
const PDF_BASE   = './assets/libros/';
const IMG_BASE   = './assets/libros/img/';

let _container = null;
let _libros    = [];
let _pdfActual = null;
let _pagActual = 1;
let _totalPags = 0;
let _pdfjsLib  = null;
let _renderTask= null;
let _touchX0   = 0;

const _q = sel => _container && _container.querySelector(sel);

export async function init(container) {
  _container = container;
  await _cargarLibros();
  _renderShell();
  _renderCintillo();
}

export function destroy() {
  _cancelarRender();
  _container = null;
  _pdfActual = null;
}

export function onEnter() {}
export function onLeave() { _cancelarRender(); }

export function pause() {
  _cancelarRender();
  const acc = document.getElementById('modulo-acciones');
  if (acc) acc.replaceChildren();
}

export async function resume(container) {
  _container = container;
  _renderCintillo();
  if (_pdfActual) _renderNavAcciones();
}

async function _cargarLibros() {
  try {
    const r = await fetchTimeout(DATA_URL, 6000);
    if (!r.ok) throw new Error('libros.json ' + r.status);
    _libros = await r.json();
  } catch(e) {
    console.error('[Libros]', e);
    _libros = [];
  }
}

async function _cargarPdfJS() {
  if (_pdfjsLib) return _pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      _pdfjsLib = window.pdfjsLib;
      resolve(_pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function _cancelarRender() {
  if (_renderTask) { _renderTask.cancel(); _renderTask = null; }
}

function _renderShell() {
  _container.innerHTML =
    '<style>' +
    '#lib-wrap { display:flex; flex-direction:column; height:100%; overflow:hidden; background:#1a1a2e; }' +

    '#lib-visor { flex:1; min-height:0; position:relative; display:flex; align-items:center; justify-content:center; background:#0f0f1a; overflow:hidden; }' +
    '#lib-canvas { max-width:100%; max-height:100%; display:block; border-radius:4px; box-shadow:0 4px 24px rgba(0,0,0,0.5); }' +
    '#lib-vacio { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:rgba(255,255,255,0.3); font-size:0.9rem; font-weight:700; }' +
    '#lib-vacio span { font-size:3rem; }' +
    '#lib-loading { position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:rgba(15,15,26,0.8); color:rgba(255,255,255,0.6); font-size:0.85rem; font-weight:700; }' +
    '#lib-loading.visible { display:flex; }' +

    '#lib-cintillo-wrap { flex-shrink:0; height:108px; background:rgba(0,0,0,0.55); border-top:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; overflow-x:auto; overflow-y:hidden; gap:8px; padding:0 12px; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; }' +
    '#lib-cintillo-wrap::-webkit-scrollbar { display:none; }' +

    '.lib-tile { flex-shrink:0; width:72px; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; scroll-snap-align:start; border-radius:10px; padding:5px 4px; transition:background 0.15s; }' +
    '.lib-tile:active { background:rgba(255,255,255,0.08); }' +
    '.lib-tile.activo { background:rgba(16,185,129,0.35); outline:2px solid rgba(16,185,129,0.7); }' +
    '.lib-tile-img { width:56px; height:72px; border-radius:6px; object-fit:cover; background:#1e2a3a; flex-shrink:0; display:flex; align-items:center; justify-content:center; }' +
    '.lib-tile-img img { width:100%; height:100%; object-fit:cover; border-radius:6px; }' +
    '.lib-tile-img .lib-tile-ico { font-size:1.8rem; }' +
    '.lib-tile-titulo { color:white; font-size:0.56rem; font-weight:800; text-align:center; line-height:1.2; max-width:68px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }' +
    '</style>' +

    '<div id="lib-wrap">' +
      '<div id="lib-visor">' +
        '<canvas id="lib-canvas" style="display:none;"></canvas>' +
        '<div id="lib-vacio"><span>📚</span><p>Elige un libro del cintillo</p></div>' +
        '<div id="lib-loading">Cargando...</div>' +
      '</div>' +
      '<div id="lib-cintillo-wrap"></div>' +
    '</div>';

  const visor = _q('#lib-visor');
  visor.addEventListener('touchstart', e => { _touchX0 = e.touches[0].clientX; }, { passive:true });
  visor.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _touchX0;
    if (Math.abs(dx) > 50) {
      if (dx < 0) _paginaSiguiente();
      else _paginaAnterior();
    }
  }, { passive:true });
}

function _renderCintillo() {
  const wrap = _q('#lib-cintillo-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  _libros.forEach((lib, i) => {
    const div = document.createElement('div');
    div.className = 'lib-tile';
    const imgUrl = IMG_BASE + lib.archivo + '.jpg';
    div.innerHTML =
      '<div class="lib-tile-img">' +
        '<img src="' + imgUrl + '" alt="' + lib.titulo + '" ' +
        'onerror="this.parentElement.innerHTML=\'<span class=lib-tile-ico>📖</span>\'">' +
      '</div>' +
      '<span class="lib-tile-titulo">' + lib.titulo + '</span>';
    div.addEventListener('click', () => _abrirLibro(lib, i));
    wrap.appendChild(div);
  });
}

async function _abrirLibro(lib, idx) {
  _q('#lib-vacio').style.display  = 'none';
  _q('#lib-canvas').style.display = 'block';
  _q('#lib-loading').classList.add('visible');

  _container.querySelectorAll('.lib-tile').forEach((el, i) => {
    el.classList.toggle('activo', i === idx);
  });

  try {
    const pdfjs = await _cargarPdfJS();
    const url   = PDF_BASE + lib.archivo + '.pdf';
    _cancelarRender();
    _pdfActual = await pdfjs.getDocument(url).promise;
    _totalPags = _pdfActual.numPages;
    _pagActual = 1;
    await _renderPagina(_pagActual);
    _renderNavAcciones();
  } catch(e) {
    console.error('[Libros]', e);
    _q('#lib-loading').classList.remove('visible');
  }
}

async function _renderPagina(num) {
  if (!_pdfActual) return;
  _q('#lib-loading').classList.add('visible');
  _cancelarRender();

  const page     = await _pdfActual.getPage(num);
  const canvas   = _q('#lib-canvas');
  const visor    = _q('#lib-visor');
  const maxW     = visor.offsetWidth  - 16;
  const maxH     = visor.offsetHeight - 16;
  const vp0      = page.getViewport({ scale: 1 });
  const scale    = Math.min(maxW / vp0.width, maxH / vp0.height);
  const viewport = page.getViewport({ scale });

  canvas.width  = viewport.width;
  canvas.height = viewport.height;

  _renderTask = page.render({
    canvasContext: canvas.getContext('2d'),
    viewport,
  });

  try {
    await _renderTask.promise;
  } catch(e) {
    if (e?.name !== 'RenderingCancelledException') console.error('[Libros]', e);
  }

  _q('#lib-loading').classList.remove('visible');
  _actualizarNavAcciones();
}

function _paginaAnterior() {
  if (_pagActual > 1) { _pagActual--; _renderPagina(_pagActual); }
}

function _paginaSiguiente() {
  if (_pagActual < _totalPags) { _pagActual++; _renderPagina(_pagActual); }
}

function _renderNavAcciones() {
  const acc = document.getElementById('modulo-acciones');
  if (!acc) return;
  acc.innerHTML = '';

  const btnPrev = document.createElement('button');
  btnPrev.className = 'd-nav-btn';
  btnPrev.innerHTML = '&#9664;';
  btnPrev.id = 'lib-btn-prev';
  btnPrev.addEventListener('click', _paginaAnterior);

  const contador = document.createElement('span');
  contador.id = 'lib-contador';
  contador.style.cssText = 'color:rgba(255,255,255,0.7);font-size:0.78rem;font-weight:800;min-width:60px;text-align:center;';
  contador.textContent = _pagActual + ' / ' + _totalPags;

  const btnNext = document.createElement('button');
  btnNext.className = 'd-nav-btn';
  btnNext.innerHTML = '&#9654;';
  btnNext.id = 'lib-btn-next';
  btnNext.addEventListener('click', _paginaSiguiente);

  acc.append(btnPrev, contador, btnNext);
}

function _actualizarNavAcciones() {
  const contador = document.getElementById('lib-contador');
  const prev     = document.getElementById('lib-btn-prev');
  const next     = document.getElementById('lib-btn-next');
  if (contador) contador.textContent = _pagActual + ' / ' + _totalPags;
  if (prev) prev.style.opacity = _pagActual <= 1 ? '0.35' : '1';
  if (next) next.style.opacity = _pagActual >= _totalPags ? '0.35' : '1';
}
