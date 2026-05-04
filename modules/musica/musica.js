import { fetchTimeout } from '../../core/offline.js';

const DATA_URL   = './data/audios.json';
const AUDIO_BASE = './audios/';
const IMG_BASE   = './audios/img/';

let _container  = null;
let _canciones  = [];
let _idx        = 0;
let _audio      = null;
let _actx       = null;
let _analyser   = null;
let _source     = null;
let _rafId      = null;
let _vizMode    = 0;
let _touchX0    = 0;
let _paused     = false;

const _q = sel => _container && _container.querySelector(sel);

export async function init(container) {
  _container = container;
  _paused    = false;
  await _cargarCanciones();
  _renderShell();
  _initAudio();
  _cargarCancion(0);
  _renderCintillo();
}

export function destroy() {
  _detenerAnimacion();
  if (_audio) { _audio.pause(); _audio.src = ''; }
  if (_actx)  { _actx.close(); }
  _audio = null; _actx = null; _analyser = null; _source = null;
  _container = null;
  document.getElementById('modulo-acciones').replaceChildren();
}

export function onEnter() {
  if (_audio && !_paused) _audio.play().catch(() => {});
}

export function onLeave() {
  _paused = _audio ? _audio.paused : true;
  if (_audio) _audio.pause();
  _detenerAnimacion();
}

export function pause() {
  _paused = _audio ? _audio.paused : true;
  if (_audio) _audio.pause();
  _detenerAnimacion();
  document.getElementById('modulo-acciones').replaceChildren();
}

export async function resume(container) {
  _container = container;
  _paused    = false;
  _iniciarAnimacion();
  if (_audio) _audio.play().catch(() => {});
}

async function _cargarCanciones() {
  try {
    const r = await fetchTimeout(DATA_URL, 6000);
    if (!r.ok) throw new Error('audios.json ' + r.status);
    _canciones = await r.json();
  } catch (e) {
    console.error('[Musica]', e);
    _canciones = [];
  }
}

function _initAudio() {
  _audio = new Audio();
  _audio.crossOrigin = 'anonymous';
  _audio.addEventListener('ended', () => _siguiente());
  _audio.addEventListener('play',  () => {
    _actualizarBtnPlay();
    _iniciarAnimacion();
  });
  _audio.addEventListener('pause', () => {
    _actualizarBtnPlay();
    _detenerAnimacion();
  });
  _audio.addEventListener('timeupdate', _actualizarProgreso);

  try {
    _actx     = new (window.AudioContext || window.webkitAudioContext)();
    _analyser = _actx.createAnalyser();
    _analyser.fftSize = 256;
    _source   = _actx.createMediaElementSource(_audio);
    _source.connect(_analyser);
    _analyser.connect(_actx.destination);
  } catch (e) {
    console.warn('[Musica] AudioContext no disponible:', e);
  }
}

function _cargarCancion(i) {
  if (!_canciones.length) return;
  _idx = (i + _canciones.length) % _canciones.length;
  const c = _canciones[_idx];
  _audio.src = AUDIO_BASE + c.archivo + '.mp3';

  const titulo   = _q('#mus-titulo');
  const artista  = _q('#mus-artista');
  const portada  = _q('#mus-portada-bg');
  if (titulo)  titulo.textContent  = c.titulo;
  if (artista) artista.textContent = c.artista;
  if (portada) portada.style.backgroundImage = 'url(' + IMG_BASE + c.archivo + '.jpg)';

  _marcarCintillo(_idx);
  _actualizarProgreso();
}

function _renderShell() {
  _container.innerHTML =
    '<style>' +
    '#mus-wrap { display:flex; flex-direction:column; height:100%; overflow:hidden; background:#0a0a14; position:relative; }' +

    '#mus-viz-area { flex:1; min-height:0; position:relative; cursor:pointer; }' +
    '#mus-canvas { position:absolute; inset:0; width:100%; height:100%; }' +

    '#mus-portada-bg { position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.18; transition:background-image 0.4s; }' +

    '#mus-info { position:absolute; bottom:90px; left:0; right:0; text-align:center; pointer-events:none; padding:0 20px; }' +
    '#mus-titulo  { color:white; font-size:1.1rem; font-weight:900; text-shadow:0 2px 12px rgba(0,0,0,0.7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }' +
    '#mus-artista { color:rgba(255,255,255,0.6); font-size:0.8rem; font-weight:700; margin-top:3px; }' +

    '#mus-hint-viz { position:absolute; top:10px; right:12px; color:rgba(255,255,255,0.3); font-size:0.65rem; font-weight:700; pointer-events:none; }' +

    '#mus-controles { position:absolute; bottom:16px; left:0; right:0; display:flex; flex-direction:column; gap:6px; padding:0 20px; }' +
    '#mus-progreso-wrap { display:flex; align-items:center; gap:8px; }' +
    '#mus-tiempo-actual { color:rgba(255,255,255,0.5); font-size:0.68rem; font-weight:700; width:32px; }' +
    '#mus-tiempo-total  { color:rgba(255,255,255,0.5); font-size:0.68rem; font-weight:700; width:32px; text-align:right; }' +
    '#mus-barra { flex:1; height:4px; background:rgba(255,255,255,0.15); border-radius:4px; cursor:pointer; }' +
    '#mus-barra-fill { height:100%; border-radius:4px; background:linear-gradient(90deg,#7C3AED,#EC4899); width:0%; transition:width 0.25s linear; pointer-events:none; }' +

    '#mus-btns { display:flex; justify-content:center; align-items:center; gap:24px; }' +
    '.mus-btn { border:none; background:rgba(255,255,255,0.1); color:white; border-radius:50%; width:46px; height:46px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; cursor:pointer; transition:background 0.15s, transform 0.12s; }' +
    '.mus-btn:active { transform:scale(0.88); background:rgba(255,255,255,0.22); }' +
    '#mus-btn-play { width:58px; height:58px; font-size:1.6rem; background:linear-gradient(135deg,#7C3AED,#EC4899); }' +

    '#mus-cintillo-wrap { flex-shrink:0; height:110px; background:rgba(0,0,0,0.4); border-top:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; overflow-x:auto; overflow-y:hidden; gap:10px; padding:0 14px; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; }' +
    '#mus-cintillo-wrap::-webkit-scrollbar { display:none; }' +

    '.mus-track { flex-shrink:0; width:84px; display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; scroll-snap-align:start; border-radius:12px; padding:6px 4px; transition:background 0.15s; }' +
    '.mus-track:active { background:rgba(255,255,255,0.08); }' +
    '.mus-track.activa { background:rgba(124,58,237,0.35); }' +
    '.mus-track-img { width:64px; height:64px; border-radius:10px; object-fit:cover; background:#1a1a2e; flex-shrink:0; }' +
    '.mus-track-titulo  { color:white; font-size:0.6rem; font-weight:800; text-align:center; line-height:1.2; max-width:80px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; }' +
    '.mus-track-artista { color:rgba(255,255,255,0.45); font-size:0.55rem; font-weight:700; text-align:center; }' +
    '</style>' +

    '<div id="mus-wrap">' +
      '<div id="mus-viz-area">' +
        '<div id="mus-portada-bg"></div>' +
        '<canvas id="mus-canvas"></canvas>' +
        '<div id="mus-info">' +
          '<div id="mus-titulo">Selecciona una cancion</div>' +
          '<div id="mus-artista"></div>' +
        '</div>' +
        '<div id="mus-hint-viz">Desliza para cambiar vista</div>' +
        '<div id="mus-controles">' +
          '<div id="mus-progreso-wrap">' +
            '<span id="mus-tiempo-actual">0:00</span>' +
            '<div id="mus-barra"><div id="mus-barra-fill"></div></div>' +
            '<span id="mus-tiempo-total">0:00</span>' +
          '</div>' +
          '<div id="mus-btns">' +
            '<button class="mus-btn" id="mus-btn-prev">&#9664;&#9664;</button>' +
            '<button class="mus-btn" id="mus-btn-play" id="mus-btn-play">&#9654;</button>' +
            '<button class="mus-btn" id="mus-btn-next">&#9654;&#9654;</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="mus-cintillo-wrap"></div>' +
    '</div>';

  _q('#mus-btn-play').addEventListener('click', _togglePlay);
  _q('#mus-btn-prev').addEventListener('click', _anterior);
  _q('#mus-btn-next').addEventListener('click', _siguiente);

  _q('#mus-barra').addEventListener('click', e => {
    if (!_audio.duration) return;
    const r = e.offsetX / e.currentTarget.offsetWidth;
    _audio.currentTime = r * _audio.duration;
  });

  const vizArea = _q('#mus-viz-area');
  vizArea.addEventListener('touchstart', e => { _touchX0 = e.touches[0].clientX; }, { passive: true });
  vizArea.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - _touchX0;
    if (Math.abs(dx) > 50) { _vizMode = 1 - _vizMode; }
  }, { passive: true });
}

function _renderCintillo() {
  const wrap = _q('#mus-cintillo-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  _canciones.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'mus-track' + (i === _idx ? ' activa' : '');
    div.dataset.idx = i;
    div.innerHTML =
      '<img class="mus-track-img" src="' + IMG_BASE + c.archivo + '.jpg" alt="' + c.titulo + '" onerror="this.style.opacity=0.3">' +
      '<span class="mus-track-titulo">'  + c.titulo  + '</span>' +
      '<span class="mus-track-artista">' + c.artista + '</span>';
    div.addEventListener('click', () => {
      _cargarCancion(i);
      _resumeCtx();
      _audio.play().catch(() => {});
    });
    wrap.appendChild(div);
  });
}

function _marcarCintillo(idx) {
  if (!_container) return;
  _container.querySelectorAll('.mus-track').forEach((el, i) => {
    el.classList.toggle('activa', i === idx);
  });
  const activa = _container.querySelectorAll('.mus-track')[idx];
  if (activa) activa.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function _togglePlay() {
  _resumeCtx();
  if (_audio.paused) _audio.play().catch(() => {});
  else _audio.pause();
}

function _anterior() { _cargarCancion(_idx - 1); _resumeCtx(); _audio.play().catch(() => {}); }
function _siguiente() { _cargarCancion(_idx + 1); _resumeCtx(); _audio.play().catch(() => {}); }

function _resumeCtx() {
  if (_actx && _actx.state === 'suspended') _actx.resume();
}

function _actualizarBtnPlay() {
  const btn = _q('#mus-btn-play');
  if (btn) btn.innerHTML = _audio.paused ? '&#9654;' : '&#9646;&#9646;';
}

function _actualizarProgreso() {
  const fill = _q('#mus-barra-fill');
  const act  = _q('#mus-tiempo-actual');
  const tot  = _q('#mus-tiempo-total');
  if (!fill) return;
  const cur = _audio.currentTime || 0;
  const dur = _audio.duration   || 0;
  fill.style.width = dur ? ((cur / dur) * 100) + '%' : '0%';
  if (act) act.textContent = _fmt(cur);
  if (tot) tot.textContent = _fmt(dur);
}

function _fmt(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}

function _iniciarAnimacion() {
  if (_rafId) return;
  const canvas  = _q('#mus-canvas');
  if (!canvas) return;
  const ctx     = canvas.getContext('2d');
  const bufLen  = _analyser ? _analyser.frequencyBinCount : 128;
  const dataArr = new Uint8Array(bufLen);

  function draw() {
    _rafId = requestAnimationFrame(draw);
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (canvas.width !== W) canvas.width  = W;
    if (canvas.height !== H) canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    if (_analyser) _analyser.getByteFrequencyData(dataArr);
    else dataArr.fill(60);

    if (_vizMode === 0) {
      _drawBarras(ctx, W, H, dataArr, bufLen);
    } else {
      _drawCircular(ctx, W, H, dataArr, bufLen);
    }
  }
  draw();
}

function _detenerAnimacion() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

function _drawBarras(ctx, W, H, data, len) {
  const barW = W / len * 1.8;
  const grad = ctx.createLinearGradient(0, H, 0, 0);
  grad.addColorStop(0,   '#7C3AED');
  grad.addColorStop(0.5, '#EC4899');
  grad.addColorStop(1,   '#F5A623');

  ctx.fillStyle = grad;
  for (let i = 0; i < len; i++) {
    const v = data[i] / 255;
    const h = v * H * 0.75;
    const x = i * (barW + 1);
    const r = Math.min(barW / 2, 4);
    ctx.beginPath();
    ctx.roundRect(x, H - h, barW, h, r);
    ctx.fill();
  }

  const waveData = new Uint8Array(len);
  if (_analyser) _analyser.getByteTimeDomainData(waveData);
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < len; i++) {
    const x = (i / len) * W;
    const y = (waveData[i] / 128) * (H * 0.15) + H * 0.08;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function _drawCircular(ctx, W, H, data, len) {
  const cx  = W / 2;
  const cy  = H / 2;
  const max = Math.min(cx, cy);

  const rings = 5;
  for (let r = 0; r < rings; r++) {
    const frac    = r / rings;
    const radius  = max * 0.18 + frac * max * 0.72;
    const samples = Math.min(len, 64);
    const step    = Math.floor(len / samples);
    const amp     = (data[r * step] || 0) / 255;
    const pulse   = amp * max * 0.12;

    ctx.beginPath();
    ctx.arc(cx, cy, radius + pulse, 0, Math.PI * 2);
    const alpha = 0.15 + amp * 0.55;
    const hue   = 260 + r * 24 + amp * 40;
    ctx.strokeStyle = 'hsla(' + hue + ',80%,65%,' + alpha + ')';
    ctx.lineWidth   = 1.5 + amp * 3;
    ctx.stroke();
  }

  const spoke = 48;
  for (let i = 0; i < spoke; i++) {
    const angle = (i / spoke) * Math.PI * 2 - Math.PI / 2;
    const di    = Math.floor((i / spoke) * len);
    const v     = (data[di] || 0) / 255;
    const r0    = max * 0.18;
    const r1    = r0 + v * max * 0.72;
    const hue   = 260 + (i / spoke) * 120;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.strokeStyle = 'hsla(' + hue + ',80%,70%,' + (0.3 + v * 0.5) + ')';
    ctx.lineWidth   = 1.2 + v * 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, max * 0.16, 0, Math.PI * 2);
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, max * 0.16);
  grd.addColorStop(0,   'rgba(124,58,237,0.9)');
  grd.addColorStop(1,   'rgba(192,39,211,0.3)');
  ctx.fillStyle = grd;
  ctx.fill();
}
