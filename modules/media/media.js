/* Dotir 2 - modules/media/media.js */

import { fetchTimeout } from '../../core/offline.js';
import AudioManager, { VideoManager, MediaStop } from '../../core/audio.js';

const DATA_URL   = './data/media.json';
const AUDIO_BASE = './assets/audio/';
const VIDEO_BASE = './assets/videos/';
const IMG_AUDIO  = './assets/audio/img/';
const IMG_VIDEO  = './assets/videos/img/';

let _container = null;
let _items     = [];
let _rafId     = null;
let _vizMode   = 0;
let _touchX0   = 0;
let _hue       = 0;
let _cbPlay    = null;
let _cbStop    = null;

const _q = sel => _container && _container.querySelector(sel);

// -- Ciclo de vida ---

export async function init(container) {
  _container = container;
  const lista = await _cargarItems();
  if (!_container) return;
  _items = lista;
  if (!AudioManager.canciones.length) {
    AudioManager.setCanciones(_items.filter(i => i.tipo === 'audio'));
  }
  _renderShell();
  _renderCintillo();
  _iniciarAnimacion();
  _cbPlay = idx => { if (!_container) return; _marcarCintillo(idx); };
  _cbStop = () => {
    if (!_container) return;
    const t = _q('#med-titulo');
    if (t) t.textContent = 'Toca un elemento para reproducir';
    _marcarCintillo(-1);
  };
  AudioManager.onPlay(_cbPlay);
  AudioManager.onStop(_cbStop);
  VideoManager.onEnded(idx => {
    const sig = _items.findIndex((it, i) => i > idx && it.tipo === 'video');
    if (sig !== -1) _reproducir(sig);
  });
}

export function destroy() {
  _detenerAnimacion();
  if (_cbPlay) { AudioManager.offPlay(_cbPlay); _cbPlay = null; }
  if (_cbStop) { AudioManager.offStop(_cbStop); _cbStop = null; }
  VideoManager.ocultar();
  _container = null;
}

export function onEnter() {
  _iniciarAnimacion();
  const marco = _q('#med-marco');
  if (marco && VideoManager.playing) {
    VideoManager.montarEn(marco);
    VideoManager.mostrar();
  }
}

export function onLeave() {
  _detenerAnimacion();
  VideoManager.ocultar();
}

export function pause() {
  _detenerAnimacion();
  VideoManager.ocultar();
  const acc = document.getElementById('modulo-acciones');
  if (acc) acc.replaceChildren();
}

export async function resume(container) {
  _container = container;
  _renderCintillo();
  _iniciarAnimacion();
  const marco = _q('#med-marco');
  if (marco && VideoManager.playing) {
    VideoManager.montarEn(marco);
    VideoManager.mostrar();
  }
  if (AudioManager.playing && AudioManager.idx >= 0) {
    _marcarCintillo(AudioManager.idx);
    const item = _items[AudioManager.idx];
    if (item) _actualizarInfo(item);
  }
}

// -- Carga de datos ---

async function _cargarItems() {
  try {
    const r = await fetchTimeout(DATA_URL, 6000);
    if (!r.ok) throw new Error('media.json ' + r.status);
    return await r.json();
  } catch(e) {
    console.error('[Media]', e);
    return [];
  }
}

// -- Shell HTML ---

function _renderShell() {
  _container.innerHTML =
    '<style>' +
    '#med-wrap{display:flex;flex-direction:column;height:100%;overflow:hidden;background:transparent;padding:10px 10px 0;gap:10px;}' +
    '#med-marco{flex:1;min-height:0;border-radius:20px;border:1.5px solid rgba(255,255,255,0.35);background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);overflow:hidden;position:relative;}' +
    '#med-canvas{position:absolute;inset:0;width:100%;height:100%;}' +
    '#med-portada-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0.10;transition:background-image 0.6s;border-radius:20px;}' +
    '#med-info{position:absolute;bottom:16px;left:0;right:0;text-align:center;pointer-events:none;padding:0 24px;}' +
    '#med-titulo{color:white;font-size:1.1rem;font-weight:900;text-shadow:0 2px 16px rgba(0,0,0,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '#med-subtitulo{color:rgba(255,255,255,0.55);font-size:0.78rem;font-weight:700;margin-top:3px;}' +
    '#med-hint{position:absolute;top:10px;right:14px;color:rgba(255,255,255,0.22);font-size:0.58rem;font-weight:700;pointer-events:none;}' +
    '#med-cintillo{flex-shrink:0;height:108px;border-radius:16px;border:1.5px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.60);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);margin-bottom:10px;display:flex;align-items:center;overflow-x:auto;overflow-y:hidden;gap:8px;padding:0 12px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;}' +
    '#med-cintillo::-webkit-scrollbar{display:none;}' +
    '.med-tile{flex-shrink:0;width:84px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;scroll-snap-align:start;border-radius:10px;padding:5px 4px;transition:background 0.15s;position:relative;}' +
    '.med-tile:active{background:rgba(255,255,255,0.08);}' +
    '.med-tile.activo{background:rgba(124,58,237,0.40);outline:2px solid rgba(124,58,237,0.8);}' +
    '.med-tile.activo-video{background:rgba(239,68,68,0.35);outline:2px solid rgba(239,68,68,0.7);}' +
    '.med-thumb{width:72px;height:60px;border-radius:8px;object-fit:cover;background:rgba(255,255,255,0.08);flex-shrink:0;}' +
    '.med-thumb-wrap{position:relative;width:72px;height:60px;}' +
    '.med-thumb-wrap img{width:72px;height:60px;border-radius:8px;object-fit:cover;}' +
    '.med-badge{position:absolute;top:3px;right:3px;font-size:0.65rem;background:rgba(0,0,0,0.65);border-radius:4px;padding:1px 4px;color:white;font-weight:800;}' +
    '.med-tile-titulo{color:white;font-size:0.55rem;font-weight:800;text-align:center;line-height:1.2;max-width:80px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}' +
    '</style>' +
    '<div id="med-wrap">' +
      '<div id="med-marco">' +
        '<div id="med-portada-bg"></div>' +
        '<canvas id="med-canvas"></canvas>' +
        '<div id="med-hint">Desliza para cambiar vista</div>' +
        '<div id="med-info">' +
          '<div id="med-titulo">Toca un elemento para reproducir</div>' +
          '<div id="med-subtitulo"></div>' +
        '</div>' +
      '</div>' +
      '<div id="med-cintillo"></div>' +
    '</div>';

  const viz = _q('#med-marco');
  viz.addEventListener('touchstart', e => { _touchX0 = e.touches[0].clientX; }, { passive: true });
  viz.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _touchX0;
    if (Math.abs(dx) > 50) {
      _vizMode = (_vizMode + 1) % 2;
    }
  }, { passive: true });
}

// -- Cintillo ---

function _renderCintillo() {
  const wrap = _q('#med-cintillo');
  if (!wrap) return;
  wrap.innerHTML = '';
  _items.forEach((item, i) => {
    const tile = document.createElement('div');
    tile.className = 'med-tile';
    const esAudio = item.tipo === 'audio';
    const imgBase = esAudio ? IMG_AUDIO : IMG_VIDEO;
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'med-thumb-wrap';
    const img = document.createElement('img');
    img.src = imgBase + item.archivo + '.jpg';
    img.alt = item.titulo;
    img.onerror = () => { img.style.opacity = '0.15'; };
    const badge = document.createElement('span');
    badge.className = 'med-badge';
    badge.textContent = esAudio ? '\u266B' : '\u25B6';
    thumbWrap.appendChild(img);
    thumbWrap.appendChild(badge);
    const titulo = document.createElement('span');
    titulo.className = 'med-tile-titulo';
    titulo.textContent = item.titulo;
    tile.appendChild(thumbWrap);
    tile.appendChild(titulo);
    tile.addEventListener('click', () => _reproducir(i));
    wrap.appendChild(tile);
  });
  // Marcar el que este activo
  if (AudioManager.playing && AudioManager.idx >= 0) _marcarCintillo(AudioManager.idx);
  else if (VideoManager.playing && VideoManager.idx >= 0) _marcarCintillo(VideoManager.idx);
}

function _marcarCintillo(idx) {
  if (!_container) return;
  const tiles = _container.querySelectorAll('.med-tile');
  tiles.forEach((el, i) => {
    el.classList.remove('activo', 'activo-video');
    if (i === idx) {
      const esVideo = _items[i]?.tipo === 'video';
      el.classList.add(esVideo ? 'activo-video' : 'activo');
    }
  });
  if (idx >= 0 && tiles[idx]) {
    tiles[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// -- Reproduccion ---

function _reproducir(idx) {
  const item = _items[idx];
  if (!item) return;
  if (item.tipo === 'audio') {
    // Detener video si estaba corriendo
    if (VideoManager.playing) VideoManager.stop();
    _mostrarVisualizador();
    AudioManager.play(idx, AUDIO_BASE + item.archivo + '.mp3');
    _actualizarInfo(item);
    _marcarCintillo(idx);
  } else {
    // Detener audio si estaba corriendo
    if (AudioManager.playing) AudioManager.stop();
    _ocultarVisualizador();
    const marco = _q('#med-marco');
    if (marco) {
      VideoManager.montarEn(marco);
      VideoManager.play(idx, VIDEO_BASE + item.archivo + '.mp4');
      VideoManager.mostrar();
    }
    _actualizarInfo(item);
    _marcarCintillo(idx);
  }
}

function _actualizarInfo(item) {
  const titulo    = _q('#med-titulo');
  const subtitulo = _q('#med-subtitulo');
  const bg        = _q('#med-portada-bg');
  const imgBase   = item.tipo === 'audio' ? IMG_AUDIO : IMG_VIDEO;
  if (titulo)    titulo.textContent    = item.titulo;
  if (subtitulo) subtitulo.textContent = item.artista || '';
  if (bg)        bg.style.backgroundImage = 'url(' + imgBase + item.archivo + '.jpg)';
}

function _mostrarVisualizador() {
  const canvas = _q('#med-canvas');
  const bg     = _q('#med-portada-bg');
  const info   = _q('#med-info');
  const hint   = _q('#med-hint');
  if (canvas) canvas.style.display = '';
  if (bg)     bg.style.display     = '';
  if (info)   info.style.display   = '';
  if (hint)   hint.style.display   = '';
  _iniciarAnimacion();
}

function _ocultarVisualizador() {
  _detenerAnimacion();
  const canvas = _q('#med-canvas');
  const bg     = _q('#med-portada-bg');
  const info   = _q('#med-info');
  const hint   = _q('#med-hint');
  if (canvas) canvas.style.display = 'none';
  if (bg)     bg.style.display     = 'none';
  if (info)   info.style.display   = 'none';
  if (hint)   hint.style.display   = 'none';
}

// -- Animacion visualizador ---

function _iniciarAnimacion() {
  if (_rafId) return;
  const canvas = _q('#med-canvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const bufLen = AudioManager.analyser ? AudioManager.analyser.frequencyBinCount : 128;
  const freqArr = new Uint8Array(bufLen);
  const timeArr = new Uint8Array(bufLen);

  function draw() {
    _rafId = requestAnimationFrame(draw);
    if (!_container) { cancelAnimationFrame(_rafId); _rafId = null; return; }
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (canvas.width  !== W) canvas.width  = W;
    if (canvas.height !== H) canvas.height = H;
    if (AudioManager.analyser) {
      AudioManager.analyser.getByteFrequencyData(freqArr);
      AudioManager.analyser.getByteTimeDomainData(timeArr);
    } else {
      freqArr.fill(40); timeArr.fill(128);
    }
    _hue = (_hue + 0.4) % 360;
    ctx.clearRect(0, 0, W, H);
    if (_vizMode === 0) _drawBarras(ctx, W, H, freqArr, timeArr, bufLen);
    else                _drawCircular(ctx, W, H, freqArr, bufLen);
  }
  draw();
}

function _detenerAnimacion() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

function _drawBarras(ctx, W, H, freq, time, len) {
  const count = Math.min(len, 80);
  const barW  = (W / count) * 0.72;
  const gap   = (W / count) * 0.28;
  for (let i = 0; i < count; i++) {
    const v   = freq[i] / 255;
    const h   = Math.max(4, v * H * 0.82);
    const x   = i * (barW + gap);
    const hue = (_hue + i * 3.2) % 360;
    const sat = 70 + v * 30;
    const lit = 45 + v * 25;
    const grad = ctx.createLinearGradient(0, H - h, 0, H);
    grad.addColorStop(0,   'hsla(' + hue + ',' + sat + '%,' + lit + '%,1)');
    grad.addColorStop(0.6, 'hsla(' + ((hue+40)%360) + ',' + sat + '%,' + (lit-10) + '%,0.85)');
    grad.addColorStop(1,   'hsla(' + ((hue+80)%360) + ',60%,30%,0.4)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, H - h, barW, h, [Math.min(barW/2, 6), Math.min(barW/2, 6), 0, 0]);
    ctx.fill();
    if (v > 0.3) {
      ctx.fillStyle = 'rgba(255,255,255,' + (v * 0.6) + ')';
      ctx.fillRect(x, H - h, barW, 2);
    }
  }
  ctx.beginPath();
  ctx.lineWidth   = 2.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.shadowColor = 'rgba(255,255,255,0.4)';
  ctx.shadowBlur  = 8;
  for (let i = 0; i < len; i++) {
    const x = (i / len) * W;
    const y = ((time[i] - 128) / 128) * (H * 0.14) + H * 0.1;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function _drawCircular(ctx, W, H, freq, len) {
  const cx = W / 2, cy = H / 2;
  const r0 = Math.min(W, H) * 0.22;
  const count = Math.min(len, 120);
  for (let i = 0; i < count; i++) {
    const v     = freq[i] / 255;
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const len2  = r0 * 0.3 + v * r0 * 1.1;
    const hue   = (_hue + i * 3) % 360;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * (r0 + len2), cy + Math.sin(angle) * (r0 + len2));
    ctx.lineWidth   = 2.5 + v * 2;
    ctx.strokeStyle = 'hsla(' + hue + ',80%,' + (50 + v * 30) + '%,' + (0.6 + v * 0.4) + ')';
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}