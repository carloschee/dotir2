/* Dotir 2 - modules/videos/videos.js
   Usa VideoManager (singleton persistente) de core/audio.js
   El video sigue reproduciendose al cambiar de seccion.
*/

import { fetchTimeout } from '../../core/offline.js';
import AudioManager, { VideoManager, MediaStop } from '../../core/audio.js';

const DATA_URL = './data/videos.json';
const IMG_BASE = './assets/videos/img/';
const VID_BASE = './assets/videos/';

let _container = null;
let _videos    = [];

const _q = sel => _container && _container.querySelector(sel);

export async function init(container) {
  _container = container;
  await _cargarVideos();
  _renderShell();
  // Montar el video singleton en el marco de este contenedor
  const marco = _q('#vid-marco');
  VideoManager.montarEn(marco);
  VideoManager.mostrar();
  _renderCintillo();
  // Si hay video en curso marcarlo en el cintillo
  if (VideoManager.playing) _marcarCintillo(VideoManager.idx);
  // Al terminar un video avanzar al siguiente
  VideoManager.onEnded(idx => {
    if (idx + 1 < _videos.length) _reproducirIdx(idx + 1);
  });
}

export function destroy() {
  VideoManager.ocultar();
  _container = null;
}

export function onEnter() {
  // Remontar el video en el marco correcto al volver
  const marco = _q('#vid-marco');
  if (marco) {
    VideoManager.montarEn(marco);
    VideoManager.mostrar();
  }
}

export function onLeave() {
  // No detener — el video sigue en background
  VideoManager.ocultar();
}

export function pause() {
  VideoManager.ocultar();
  const acc = document.getElementById('modulo-acciones');
  if (acc) acc.replaceChildren();
}

export async function resume(container) {
  _container = container;
  const marco = _q('#vid-marco');
  if (marco) {
    VideoManager.montarEn(marco);
    VideoManager.mostrar();
  }
  _renderCintillo();
  if (VideoManager.playing) _marcarCintillo(VideoManager.idx);
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
    '#vid-wrap { display:flex; flex-direction:column; height:100%; overflow:hidden; background:transparent; padding:10px 10px 0; gap:10px; }' +
    '#vid-marco { flex:1; min-height:0; border-radius:20px; border:1.5px solid rgba(255,255,255,0.25); background:rgba(0,0,0,0.45); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center; }' +
    '#vid-vacio { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:rgba(255,255,255,0.3); font-size:0.9rem; font-weight:700; pointer-events:none; }' +
    '#vid-vacio span { font-size:3rem; }' +
    '#vid-cintillo-wrap { flex-shrink:0; height:108px; background:rgba(0,0,0,0.30); border:1.5px solid rgba(255,255,255,0.12); border-radius:16px; margin-bottom:10px; display:flex; align-items:center; overflow-x:auto; overflow-y:hidden; gap:8px; padding:0 12px; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; }' +
    '#vid-cintillo-wrap::-webkit-scrollbar { display:none; }' +
    '.vid-tile { flex-shrink:0; width:140px; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; scroll-snap-align:start; border-radius:10px; padding:5px 4px; transition:background 0.15s; }' +
    '.vid-tile:active { background:rgba(255,255,255,0.08); }' +
    '.vid-tile.activo { background:rgba(239,68,68,0.35); outline:2px solid rgba(239,68,68,0.7); }' +
    '.vid-thumb { width:132px; height:74px; border-radius:8px; background:rgba(255,255,255,0.08); flex-shrink:0; overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center; }' +
    '.vid-thumb img { width:100%; height:100%; object-fit:cover; border-radius:8px; }' +
    '.vid-thumb .vid-ico { position:absolute; font-size:1.5rem; opacity:0.9; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8)); }' +
    '.vid-tile-titulo { color:white; font-size:0.55rem; font-weight:800; text-align:center; line-height:1.2; max-width:132px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }' +
    '</style>' +
    '<div id="vid-wrap">' +
      '<div id="vid-marco">' +
        '<div id="vid-vacio"><span>\u{1F3AC}</span><p>Elige un video del cintillo</p></div>' +
      '</div>' +
      '<div id="vid-cintillo-wrap"></div>' +
    '</div>';
}

function _renderCintillo() {
  const wrap = _q('#vid-cintillo-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  _videos.forEach((v, i) => {
    const tile  = document.createElement('div');
    tile.className = 'vid-tile' + (i === VideoManager.idx ? ' activo' : '');
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

function _marcarCintillo(idx) {
  if (!_container) return;
  _container.querySelectorAll('.vid-tile').forEach((el, i) => {
    el.classList.toggle('activo', i === idx);
  });
  const activo = _container.querySelectorAll('.vid-tile')[idx];
  if (activo) activo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function _reproducirIdx(idx) {
  if (!_videos.length) return;
  idx = Math.max(0, Math.min(_videos.length - 1, idx));
  const v = _videos[idx];
  if (!v) return;
  // Ocultar placeholder
  const vacio = _q('#vid-vacio');
  if (vacio) vacio.style.display = 'none';
  // Detener audio si habia
  if (AudioManager.playing) AudioManager.stop();
  VideoManager.play(idx, VID_BASE + v.archivo + '.mp4');
  _marcarCintillo(idx);
}
