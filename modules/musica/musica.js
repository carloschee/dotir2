import { fetchTimeout } from '../../core/offline.js';

const DATA_URL   = './data/audios.json';
const AUDIO_BASE = './assets/audio/';
const IMG_BASE   = './assets/audio/img/';

let _container = null;
let _canciones = [];
let _idx       = 0;
let _audio     = null;
let _actx      = null;
let _analyser  = null;
let _source    = null;
let _rafId     = null;
let _vizMode   = 0;
let _touchX0   = 0;
let _paused    = false;
let _hue       = 0;

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
  const acc = document.getElementById('modulo-acciones');
  if (acc) acc.replaceChildren();
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
  const acc = document.getElementById('modulo-acciones');
  if (acc) acc.replaceChildren();
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
  _audio.addEventListener('ended',       () => _siguiente());
  _audio.addEventListener('play',        () => { _actualizarBtnPlay(); _iniciarAnimacion(); });
  _audio.addEventListener('pause',       () => { _actualizarBtnPlay(); _detenerAnimacion(); });
  _audio.addEventListener('timeupdate',  _actualizarProgreso);
  try {
    _actx     = new (window.AudioContext || window.webkitAudioContext)();
    _analyser = _actx.createAnalyser();
    _analyser.fftSize        = 512;
    _analyser.smoothingTimeConstant = 0.82;
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
  const titulo  = _q('#mus-titulo');
  const artista = _q('#mus-artista');
  const bg      = _q('#mus-portada-bg');
  if (titulo)  titulo.textContent  = c.titulo;
  if (artista) artista.textContent = c.artista;
  if (bg)      bg.style.backgroundImage = 'url(' + IMG_BASE + c.archivo + '.jpg)';
  _marcarCintillo(_idx);
  _actualizarProgreso();
}

function _renderShell() {
  _container.innerHTML =
    '<style>' +
    '#mus-wrap {' +
    '  display:flex; flex-direction:column; height:100%; overflow:hidden;' +
    '  background:#07070f; position:relative;' +
    '}' +

    /* Visualizador — ocupa todo el espacio disponible */
    '#mus-viz-area {' +
    '  flex:1; min-height:0; position:relative;' +
    '}' +
    '#mus-canvas {' +
    '  position:absolute; inset:0; width:100%; height:100%;' +
    '}' +
    '#mus-portada-bg {' +
    '  position:absolute; inset:0;' +
    '  background-size:cover; background-position:center;' +
    '  opacity:0.12; transition:background-image 0.6s;' +
    '}' +

    /* Info de cancion superpuesta al visualizador */
    '#mus-info {' +
    '  position:absolute; bottom:100px; left:0; right:0;' +
    '  text-align:center; pointer-events:none; padding:0 24px;' +
    '}' +
    '#mus-titulo {' +
    '  color:white; font-size:1.15rem; font-weight:900;' +
    '  text-shadow:0 2px 16px rgba(0,0,0,0.8);' +
    '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;' +
    '}' +
    '#mus-artista {' +
    '  color:rgba(255,255,255,0.55); font-size:0.82rem; font-weight:700;' +
    '  margin-top:4px; text-shadow:0 2px 8px rgba(0,0,0,0.6);' +
    '}' +

    '#mus-hint {' +
    '  position:absolute; top:8px; right:12px;' +
    '  color:rgba(255,255,255,0.25); font-size:0.6rem; font-weight:700;' +
    '  pointer-events:none;' +
    '}' +

    /* Controles superpuestos al visualizador */
    '#mus-controles {' +
    '  position:absolute; bottom:0; left:0; right:0;' +
    '  display:flex; flex-direction:column; gap:8px; padding:0 20px 14px;' +
    '  background:linear-gradient(transparent, rgba(7,7,15,0.85) 40%);' +
    '}' +
    '#mus-progreso-wrap {' +
    '  display:flex; align-items:center; gap:8px;' +
    '}' +
    '.mus-tiempo {' +
    '  color:rgba(255,255,255,0.45); font-size:0.68rem; font-weight:700; width:34px;' +
    '}' +
    '#mus-tiempo-total { text-align:right; }' +
    '#mus-barra {' +
    '  flex:1; height:5px; background:rgba(255,255,255,0.12);' +
    '  border-radius:5px; cursor:pointer; position:relative;' +
    '}' +
    '#mus-barra-fill {' +
    '  height:100%; border-radius:5px; width:0%;' +
    '  background:linear-gradient(90deg,#7C3AED,#EC4899,#F5A623);' +
    '  transition:width 0.25s linear; pointer-events:none;' +
    '}' +

    '#mus-btns {' +
    '  display:flex; justify-content:center; align-items:center; gap:20px;' +
    '}' +
    '.mus-btn {' +
    '  border:none; background:rgba(255,255,255,0.12); color:white;' +
    '  border-radius:50%; width:44px; height:44px;' +
    '  display:flex; align-items:center; justify-content:center;' +
    '  font-size:1.1rem; cursor:pointer;' +
    '  transition:background 0.15s, transform 0.12s;' +
    '}' +
    '.mus-btn:active { transform:scale(0.88); background:rgba(255,255,255,0.25); }' +
    '#mus-btn-play {' +
    '  width:60px; height:60px; font-size:1.5rem;' +
    '  background:linear-gradient(135deg,#7C3AED,#EC4899);' +
    '  box-shadow:0 4px 20px rgba(124,58,237,0.5);' +
    '}' +

    /* Cintillo inferior — altura fija, sin espacio blanco */
    '#mus-cintillo-wrap {' +
    '  flex-shrink:0; height:108px;' +
    '  background:rgba(0,0,0,0.55);' +
    '  border-top:1px solid rgba(255,255,255,0.07);' +
    '  display:flex; align-items:center;' +
    '  overflow-x:auto; overflow-y:hidden;' +
    '  gap:8px; padding:0 12px;' +
    '  scroll-snap-type:x mandatory;' +
    '  -webkit-overflow-scrolling:touch;' +
    '  scrollbar-width:none;' +
    '}' +
    '#mus-cintillo-wrap::-webkit-scrollbar { display:none; }' +

    '.mus-track {' +
    '  flex-shrink:0; width:80px;' +
    '  display:flex; flex-direction:column; align-items:center; gap:4px;' +
    '  cursor:pointer; scroll-snap-align:start;' +
    '  border-radius:10px; padding:5px 4px;' +
    '  transition:background 0.15s;' +
    '}' +
    '.mus-track:active { background:rgba(255,255,255,0.08); }' +
    '.mus-track.activa { background:rgba(124,58,237,0.4); }' +
    '.mus-track-img {' +
    '  width:60px; height:60px; border-radius:8px;' +
    '  object-fit:cover; background:#1a1a2e; flex-shrink:0;' +
    '}' +
    '.mus-track-titulo {' +
    '  color:white; font-size:0.58rem; font-weight:800;' +
    '  text-align:center; line-height:1.2; max-width:76px;' +
    '  overflow:hidden; display:-webkit-box;' +
    '  -webkit-line-clamp:2; -webkit-box-orient:vertical;' +
    '}' +
    '.mus-track-artista {' +
    '  color:rgba(255,255,255,0.4); font-size:0.52rem; font-weight:700;' +
    '  text-align:center;' +
    '}' +
    '</style>' +

    '<div id="mus-wrap">' +
      '<div id="mus-viz-area">' +
        '<div id="mus-portada-bg"></div>' +
        '<canvas id="mus-canvas"></canvas>' +
        '<div id="mus-hint">Desliza para cambiar vista</div>' +
        '<div id="mus-info">' +
          '<div id="mus-titulo">Elige una cancion</div>' +
          '<div id="mus-artista"></div>' +
        '</div>' +
        '<div id="mus-controles">' +
          '<div id="mus-progreso-wrap">' +
            '<span class="mus-tiempo" id="mus-tiempo-actual">0:00</span>' +
            '<div id="mus-barra"><div id="mus-barra-fill"></div></div>' +
            '<span class="mus-tiempo" id="mus-tiempo-total">0:00</span>' +
          '</div>' +
          '<div id="mus-btns">' +
            '<button class="mus-btn" id="mus-btn-prev">&#9664;&#9664;</button>' +
            '<button class="mus-btn" id="mus-btn-play">&#9654;</button>' +
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
    if (!_audio || !_audio.duration) return;
    const r = e.offsetX / e.currentTarget.offsetWidth;
    _audio.currentTime = r * _audio.duration;
  });

  const viz = _q('#mus-viz-area');
  viz.addEventListener('touchstart', e => {
    _touchX0 = e.touches[0].clientX;
  }, { passive: true });
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
  _canciones.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'mus-track' + (i === _idx ? ' activa' : '');
    div.dataset.idx = i;
    div.innerHTML =
      '<img class="mus-track-img" src="' + IMG_BASE + c.archivo + '.jpg"' +
      ' alt="' + c.titulo + '" onerror="this.style.opacity=\'0.15\'">' +
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

function _anterior() {
  _cargarCancion(_idx - 1);
  _resumeCtx();
  _audio.play().catch(() => {});
}

function _siguiente() {
  _cargarCancion(_idx + 1);
  _resumeCtx();
  _audio.play().catch(() => {});
}

function _resumeCtx() {
  if (_actx && _actx.state === 'suspended') _actx.resume();
}

function _actualizarBtnPlay() {
  const btn = _q('#mus-btn-play');
  if (btn) btn.innerHTML = (_audio && !_audio.paused) ? '&#9646;&#9646;' : '&#9654;';
}

function _actualizarProgreso() {
  const fill = _q('#mus-barra-fill');
  const act  = _q('#mus-tiempo-actual');
  const tot  = _q('#mus-tiempo-total');
  if (!fill || !_audio) return;
  const cur = _audio.currentTime || 0;
  const dur = _audio.duration   || 0;
  fill.style.width = dur ? ((cur / dur) * 100) + '%' : '0%';
  if (act) act.textContent = _fmt(cur);
  if (tot) tot.textContent = _fmt(dur);
}

function _fmt(s) {
  const m  = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}

function _iniciarAnimacion() {
  if (_rafId) return;
  const canvas = _q('#mus-canvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const bufLen = _analyser ? _analyser.frequencyBinCount : 128;
  const freqArr = new Uint8Array(bufLen);
  const timeArr = new Uint8Array(bufLen);

  function draw() {
    _rafId = requestAnimationFrame(draw);
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (canvas.width !== W)  canvas.width  = W;
    if (canvas.height !== H) canvas.height = H;

    if (_analyser) {
      _analyser.getByteFrequencyData(freqArr);
      _analyser.getByteTimeDomainData(timeArr);
    } else {
      freqArr.fill(40); timeArr.fill(128);
    }

    _hue = (_hue + 0.4) % 360;

    ctx.clearRect(0, 0, W, H);

    if (_vizMode === 0) {
      _drawBarras(ctx, W, H, freqArr, timeArr, bufLen);
    } else {
      _drawCircular(ctx, W, H, freqArr, bufLen);
    }
  }
  draw();
}

function _detenerAnimacion() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

/* ── Visualizador 1: Barras + onda ── */
function _drawBarras(ctx, W, H, freq, time, len) {
  const count = Math.min(len, 80);
  const barW  = (W / count) * 0.72;
  const gap   = (W / count) * 0.28;

  for (let i = 0; i < count; i++) {
    const v    = freq[i] / 255;
    const h    = Math.max(4, v * H * 0.82);
    const x    = i * (barW + gap);
    const hue  = (_hue + i * 3.2) % 360;
    const sat  = 70 + v * 30;
    const lit  = 45 + v * 25;

    const grad = ctx.createLinearGradient(0, H - h, 0, H);
    grad.addColorStop(0,   'hsla(' + hue + ',' + sat + '%,' + lit + '%,1)');
    grad.addColorStop(0.6, 'hsla(' + ((hue + 40) % 360) + ',' + sat + '%,' + (lit - 10) + '%,0.85)');
    grad.addColorStop(1,   'hsla(' + ((hue + 80) % 360) + ',60%,30%,0.4)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, H - h, barW, h, [Math.min(barW / 2, 6), Math.min(barW / 2, 6), 0, 0]);
    ctx.fill();

    /* Brillo en la punta */
    if (v > 0.3) {
      ctx.fillStyle = 'rgba(255,255,255,' + (v * 0.6) + ')';
      ctx.fillRect(x, H - h, barW, 2);
    }
  }

  /* Onda de tiempo */
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

/* ── Visualizador 2: Circular con flores ── */
function _drawCircular(ctx, W, H, freq, len) {
  const cx   = W / 2;
  const cy   = H / 2;
  const maxR = Math.min(cx, cy) * 0.88;

  /* Fondo radial pulsante */
  const avg  = freq.reduce((a, b) => a + b, 0) / len / 255;
  const bgR  = maxR * 0.55 * (0.6 + avg * 0.4);
  const bgG  = ctx.createRadialGradient(cx, cy, 0, cx, cy, bgR);
  bgG.addColorStop(0,   'hsla(' + _hue + ',60%,20%,0.35)');
  bgG.addColorStop(0.5, 'hsla(' + ((_hue + 60) % 360) + ',70%,15%,0.15)');
  bgG.addColorStop(1,   'transparent');
  ctx.fillStyle = bgG;
  ctx.beginPath();
  ctx.arc(cx, cy, bgR, 0, Math.PI * 2);
  ctx.fill();

  const samples = 128;
  const step    = Math.floor(len / samples);

  /* Petalos exterior */
  const petalos = 12;
  for (let p = 0; p < petalos; p++) {
    const angle  = (p / petalos) * Math.PI * 2 - Math.PI / 2;
    const di     = Math.floor((p / petalos) * len);
    const v      = freq[di] / 255;
    const r0     = maxR * 0.22;
    const r1     = r0 + v * maxR * 0.55;
    const spread = 0.18 + v * 0.08;

    const hue = (_hue + p * (360 / petalos)) % 360;
    const grd = ctx.createLinearGradient(
      cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0,
      cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1
    );
    grd.addColorStop(0, 'hsla(' + hue + ',90%,70%,0.9)');
    grd.addColorStop(1, 'hsla(' + ((hue + 40) % 360) + ',80%,55%,0)');

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx + Math.cos(angle) * ((r0 + r1) / 2),
            cy + Math.sin(angle) * ((r0 + r1) / 2),
            (r1 - r0) / 2 + v * 12,
            angle - spread - Math.PI / 2,
            angle + spread - Math.PI / 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }

  /* Rayos FFT */
  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * Math.PI * 2 - Math.PI / 2;
    const v     = freq[i * step] / 255;
    const r0    = maxR * 0.22;
    const r1    = r0 + v * maxR * 0.68;
    const hue   = (_hue + (i / samples) * 200) % 360;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.strokeStyle = 'hsla(' + hue + ',85%,65%,' + (0.25 + v * 0.6) + ')';
    ctx.lineWidth   = 1 + v * 2.5;
    ctx.stroke();
  }

  /* Anillos concentricos */
  [0.22, 0.42, 0.65].forEach((frac, ri) => {
    const di    = Math.floor(frac * len);
    const v     = freq[di] / 255;
    const r     = maxR * frac + v * 10;
    const hue   = (_hue + ri * 60) % 360;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsla(' + hue + ',80%,65%,' + (0.12 + v * 0.35) + ')';
    ctx.lineWidth   = 1.5 + v * 4;
    ctx.stroke();
  });

  /* Nucleo brillante */
  const nucR = maxR * 0.10 + avg * maxR * 0.08;
  const nucG = ctx.createRadialGradient(cx, cy, 0, cx, cy, nucR);
  nucG.addColorStop(0,   'hsla(' + _hue + ',100%,90%,1)');
  nucG.addColorStop(0.4, 'hsla(' + _hue + ',90%,70%,0.8)');
  nucG.addColorStop(1,   'hsla(' + ((_hue + 60) % 360) + ',80%,50%,0)');
  ctx.fillStyle = nucG;
  ctx.beginPath();
  ctx.arc(cx, cy, nucR, 0, Math.PI * 2);
  ctx.fill();
}
