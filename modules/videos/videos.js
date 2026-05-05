/* Dotir 2 - modules/videos/videos.js
   Reproductor de video limpio sin controles ni overlays.
   Solo el video a pantalla completa y cintillo inferior.
   Deslizar izquierda/derecha cambia de video.
*/

import { fetchTimeout } from '../../core/offline.js';

const DATA_URL   = './data/videos.json';
const VIDEO_BASE = './assets/videos/';
const IMG_BASE   = './assets/videos/img/';

let _container = null;
let _videos    = [];
let _idxActual = -1;
let _touchX0   = 0;

const _q = sel => _container && _container.querySelector(sel);

export async function init(container) {
  _container = container;
  await _cargarVideos();
  _renderShell();
  _renderCintillo();
}

export function destroy() {
  _detenerVideo();
  _container = null;
  _idxActual = -1;
}

export function onEnter() {}

export function onLeave() {
  _detenerVideo();
}

export function pause() {
  _detenerVideo();
  const acc = document.getElementById('modulo-acciones');
  if (acc) acc.replaceChildren();
}

export async function resume(container) {
  _container = container;
  _renderCintillo();
}

function _detenerVideo() {
  const vid = _q('#vid-player');
  if (!vid) return;
  vid.pause();
  vid.removeAttribute('src');
  vid.load();
}

async function _cargarVideos() {
  try {
    const r = await fetchTimeout(DATA_URL, 6000);
    if (!r.ok) throw new Error('videos.json ' + r.status);
    _videos = await r.json();
  } catch (e) {
    console.error('[Videos]', e);
    _videos = [];
  }
}

function _renderShell() {
  _container.innerHTML =
    '<style>' +
    '#vid-wrap { display:flex; flex-direction:column; height:100%; overflow:hidden; background:#000; }' +

    '#vid-area { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; background:#000; overflow:hidden; }' +

    '#vid-player { width:100%; height:100%; object-fit:contain; display:none; pointer-events:none; }' +

    '#vid-vacio { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:rgba(255,255,255,0.25); font-size:0.9rem; font-weight:700; width:100%; height:100%; }' +
    '#vid-vacio span { font-size:3rem; }' +

    '#vid-cintillo-wrap { flex-shrink:0; height:108px; background:rgba(0,0,0,0.7); border-top:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; overflow-x:auto; overflow-y:hidden; gap:8px; padding:0 12px; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; }' +
    '#vid-cintillo-wrap::-webkit-scrollbar { display:none; }' +

    '.vid-tile { flex-shrink:0; width:140px; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; scroll-snap-align:start; border-radius:10px; padding:5px 4px; transition:background 0.15s; }' +
    '.vid-tile:active { background:rgba(255,255,255,0.08); }' +
    '.vid-tile.activo { background:rgba(239,68,68,0.35); outline:2px solid rgba(239,68,68,0.7); }' +

    '.vid-thumb { width:132px; height:74px; border-radius:8px; background:#1a1a2e; flex-shrink:0; overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center; }' +
    '.vid-thumb img { width:100%; height:100%; object-fit:cover; border-radius:8px; }' +
    '.vid-thumb .vid-ico { position:absolute; font-size:1.5rem; opacity:0.9; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8)); }' +

    '.vid-tile-titulo { color:white; font-size:0.55rem; font-weight:800; text-align:center; line-height:1.2; max-width:132px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }' +
    '</style>' +

    '<div id="vid-wrap">' +
      '<div id="vid-area">' +
        '<video id="vid-player" playsinline preload="none"></video>' +
        '<div id="vid-vacio"><span>🎬</span><p>Elige un video del cintillo</p></div>' +
      '</div>' +
      '<div id="vid-cintillo-wrap"></div>' +
    '</div>';

  const area = _q('#vid-area');
  area.addEventListener('touchstart', e => {
    _touchX0 = e.touches[0].clientX;
  }, { passive: true });
  area.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _touchX0;
    if (Math.abs(dx) > 60) {
      if (dx < 0) _reproducirIdx(_idxActual + 1);
      else        _reproducirIdx(_idxActual - 1);
    }
  }, { passive: true });
}

function _renderCintillo() {
  const wrap = _q('#vid-cintillo-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  _videos.forEach((v, i) => {
    const tile = document.createElement('div');
    tile.className = 'vid-tile' + (i === _idxActual ? ' activo' : '');

    const thumb = document.createElement('div');
    thumb.className = 'vid-thumb';

    const img = document.createElement('img');
    img.src = IMG_BASE + v.archivo + '.jpg';
    img.alt = v.titulo;
    img.onerror = () => img.remove();

    const ico = document.createElement('span');
    ico.className = 'vid-ico';
    ico.textContent = '\u25B6';

    thumb.appendChild(img);
    thumb.appendChild(ico);

    const titulo = document.createElement('span');
    titulo.className = 'vid-tile-titulo';
    titulo.textContent = v.titulo;

    tile.appendChild(thumb);
    tile.appendChild(titulo);
    tile.addEventListener('click', () => _reproducirIdx(i));
    wrap.appendChild(tile);
  });
}

function _reproducirIdx(idx) {
  if (!_videos.length) return;
  idx = Math.max(0, Math.min(_videos.length - 1, idx));
  const v = _videos[idx];
  if (!v) return;

  _idxActual = idx;

  const player = _q('#vid-player');
  const vacio  = _q('#vid-vacio');
  if (!player) return;

  player.src = VIDEO_BASE + v.archivo + '.mp4';
  player.style.display = 'block';
  if (vacio) vacio.style.display = 'none';

  player.load();
  player.play().catch(() => {});

  _container.querySelectorAll('.vid-tile').forEach((el, i) => {
    el.classList.toggle('activo', i === idx);
  });
  const activo = _container.querySelectorAll('.vid-tile')[idx];
  if (activo) activo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  player.onended = () => {
    if (_idxActual + 1 < _videos.length) _reproducirIdx(_idxActual + 1);
  };
}
