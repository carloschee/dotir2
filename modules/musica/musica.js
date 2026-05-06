/* Dotir 2 - modules/musica/musica.js */

import { fetchTimeout } from '../../core/offline.js';
import AudioManager from '../../core/audio.js';

const DATA_URL   = './data/audios.json';
const AUDIO_BASE = './assets/audio/';
const IMG_BASE   = './assets/audio/img/';

let _container = null;
let _rafId     = null;
let _vizMode   = 0;
let _touchX0   = 0;
let _hue       = 0;

const _q = sel => _container && _container.querySelector(sel);

export async function init(container) {
  _container = container;
  if (!AudioManager.canciones.length) {
    const list = await _cargarCanciones();
    AudioManager.setCanciones(list);
  }
  _renderShell();
  _renderCintillo();
  _iniciarAnimacion();
  AudioManager.onPlay(idx => _marcarCintillo(idx));
  AudioManager.onStop(() => {
    if (!_container) return;
    const t = _q('#mus-titulo');
    if (t) t.textContent = 'Toca una cancion para reproducir';
    _marcarCintillo(-1);
  });
}

export function destroy() {
  _detenerAnimacion();
  _container = null;
}

export function onEnter() { _iniciarAnimacion(); }
export function onLeave() { _detenerAnimacion(); }

export function pause() {
  _detenerAnimacion();
  const acc = document.getElementById('modulo-acciones');
  if (acc) acc.replaceChildren();
}

export async function resume(container) {
  _container = container;
  _renderCintillo();
  _iniciarAnimacion();
}

async function _cargarCanciones() {
  try {
    const r = await fetchTimeout(DATA_URL, 6000);
    if (!r.ok) throw new Error('audios.json ' + r.status);
    return await r.json();
  } catch(e) {
    console.error('[Musica]', e);
    return [];
  }
}

function _renderShell() {
  _container.innerHTML =
    '<style>' +
    '#mus-wrap { display:flex; flex-direction:column; height:100%; overflow:hidden; background:transparent; padding:10px 10px 0; gap:10px; }' +

    /* Panel del visualizador */
    '#mus-viz-marco { flex:1; min-height:0; border-radius:20px; border:1.5px solid rgba(255,255,255,0.25); background:rgba(0,0,0,0.35); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); overflow:hidden; position:relative; }' +

    '#mus-canvas { position:absolute; inset:0; width:100%; height:100%; }' +
    '#mus-portada-bg { position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.10; transition:background-image 0.6s; border-radius:20px; }' +

    '#mus-info { position:absolute; bottom:16px; left:0; right:0; text-align:center; pointer-events:none; padding:0 24px; }' +
    '#mus-titulo { color:white; font-size:1.1rem; font-weight:900; text-shadow:0 2px 16px rgba(0,0,0,0.8); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }' +
    '#mus-artista { color:rgba(255,255,255,0.55); font-size:0.78rem; font-weight:700; margin-top:3px; }' +

    '#mus-hint { position:absolute; top:10px; right:14px; color:rgba(255,255,255,0.22); font-size:0.58rem; font-weight:700; pointer-events:none; }' +

    /* Panel del cintillo */
    '#mus-cintillo-wrap { flex-shrink:0; height:108px; border-radius:16px; border:1.5px solid rgba(255,255,255,0.12); background:rgba(0,0,0,0.30); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); margin-bottom:10px; display:flex; align-items:center; overflow-x:auto; overflow-y:hidden; gap:8px; padding:0 12px; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; }' +
    '#mus-cintillo-wrap::-webkit-scrollbar { display:none; }' +

    '.mus-track { flex-shrink:0; width:80px; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; scroll-snap-align:start; border-radius:10px; padding:5px 4px; transition:background 0.15s; }' +
    '.mus-track:active { background:rgba(255,255,255,0.08); }' +
    '.mus-track.activa { background:rgba(124,58,237,0.40); outline:2px solid rgba(124,58,237,0.8); }' +

    '.mus-track-img { width:60px; height:60px; border-radius:8px; object-fit:cover; background:rgba(255,255,255,0.08); flex-shrink:0; }' +
    '.mus-track-titulo { color:white; font-size:0.58rem; font-weight:800; text-align:center; line-height:1.2; max-width:76px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }' +
    '.mus-track-artista { color:rgba(255,255,255,0.4); font-size:0.52rem; font-weight:700; text-align:center; }' +
    '</style>' +

    '<div id="mus-wrap">' +
      '<div id="mus-viz-marco">' +
        '<div id="mus-portada-bg"></div>' +
        '<canvas id="mus-canvas"></canvas>' +
        '<div id="mus-hint">Desliza para cambiar vista</div>' +
        '<div id="mus-info">' +
          '<div id="mus-titulo">Toca una cancion para reproducir</div>' +
          '<div id="mus-artista"></div>' +
        '</div>' +
      '</div>' +
      '<div id="mus-cintillo-wrap"></div>' +
    '</div>';

  const viz = _q('#mus-viz-marco');
  viz.addEventListener('touchstart', e => { _touchX0 = e.touches[0].clientX; }, { passive: true });
  viz.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _touchX0;
    if (Math.abs(dx) > 50) {
      _vizMode = (_vizMode + 1) % 2;
      const hint = _q('#mus-hint');
      if (hint) {
        hint.textContent = _vizMode === 0 ? 'Vista: Barras' : 'Vista: Circular';
        clearTimeout(hint._t);
        hint._t = setTimeout(() => { hint.textContent = 'Desliza para cambiar vista'; }, 1800);
      }
    }
  }, { passive: true });
}

function _renderCintillo() {
  const wrap = _q('#mus-cintillo-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const canciones = AudioManager.canciones;
  const idxActual = AudioManager.idx;

  canciones.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'mus-track' + (i === idxActual ? ' activa' : '');
    div.innerHTML =
      '<img class="mus-track-img" src="' + IMG_BASE + c.archivo + '.jpg" alt="' + c.titulo + '" onerror="this.style.opacity=\'0.15\'">' +
      '<span class="mus-track-titulo">' + c.titulo  + '</span>' +
      '<span class="mus-track-artista">' + (c.artista || '') + '</span>';

    div.addEventListener('click', () => {
      AudioManager.play(i, AUDIO_BASE + c.archivo + '.mp3');
      _actualizarInfo(c);
      _marcarCintillo(i);
    });
    wrap.appendChild(div);
  });

  if (idxActual >= 0 && canciones[idxActual]) {
    _actualizarInfo(canciones[idxActual]);
  }
}

function _actualizarInfo(c) {
  const titulo  = _q('#mus-titulo');
  const artista = _q('#mus-artista');
  const bg      = _q('#mus-portada-bg');
  if (titulo)  titulo.textContent  = c.titulo;
  if (artista) artista.textContent = c.artista || '';
  if (bg)      bg.style.backgroundImage = 'url(' + IMG_BASE + c.archivo + '.jpg)';
}

function _marcarCintillo(idx) {
  if (!_container) return;
  _container.querySelectorAll('.mus-track').forEach((el, i) => {
    el.classList.toggle('activa', i === idx);
  });
  const activa = _container.querySelectorAll('.mus-track')[idx];
  if (activa) activa.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function _iniciarAnimacion() {
  if (_rafId) return;
  const canvas = _q('#mus-canvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const bufLen = AudioManager.analyser ? AudioManager.analyser.frequencyBinCount : 128;
  const freqArr = new Uint8Array(bufLen);
  const timeArr = new Uint8Array(bufLen);

  function draw() {
    _rafId = requestAnimationFrame(draw);
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
