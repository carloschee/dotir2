/* Dotir 2 - modules/temporizador/temporizador.js */

import { TTS } from '../../core/tts.js';
import { lanzarConfeti } from '../../core/ui.js';

let _container    = null;
let _totalMs      = 0;
let _msRestantes  = 0;
let _tiempoInicio = 0;
let _tiempoFin    = 0;
let _corriendo    = false;
let _rafId        = null;
let _audioCtx     = null;

const _q = sel => _container?.querySelector(sel);

function _getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

export async function init(container) {
  _container = container;
  _renderShell();
  _renderNavAcciones();
  _ajustarCanvas();
}

export function destroy() {
  _detener();
  window.removeEventListener('resize', _onResize);
  _container = null;
  document.getElementById('modulo-acciones')?.replaceChildren();
}

export function onEnter() { _ajustarCanvas(); }
export function onLeave() { _detener(); }

export function pause() {
  if (_corriendo) _pausar();
  document.getElementById('modulo-acciones')?.replaceChildren();
}

export async function resume(container) {
  _container = container;
  _renderNavAcciones();
  _ajustarCanvas();
}

// -- Navegacion ---
function _renderNavAcciones() {
  const acc = document.getElementById('modulo-acciones');
  if (!acc) return;
  acc.innerHTML = '';
  const btnConfig = document.createElement('button');
  btnConfig.className = 'd-nav-btn';
  btnConfig.textContent = '\u23F1 Configurar';
  btnConfig.addEventListener('click', _abrirConfig);
  acc.append(btnConfig);
}

// -- Shell HTML ---
function _renderShell() {
  _container.innerHTML = `
    <style>
      #timer-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow: hidden;
        background: transparent;
        align-items: center; justify-content: center;
        position: relative;
      }
      #timer-canvas-wrap {
        position: relative;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        user-select: none; -webkit-user-select: none;
        width: min(80vw, 80vh, 520px);
        height: min(80vw, 80vh, 520px);
        flex-shrink: 0;
      }
      #timer-canvas { touch-action: none; }
      #timer-display {
        position: absolute;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        pointer-events: none;
      }
      #timer-tiempo {
        font-size: clamp(1.4rem, 5.5vw, 3rem);
        font-weight: 900; color: #1a1a2e;
        letter-spacing: -1px; line-height: 1;
      }
      #timer-estado {
        font-size: clamp(0.55rem, 1.6vw, 0.8rem);
        font-weight: 700; color: rgba(0,0,0,0.38);
        margin-top: 5px; letter-spacing: .06em;
        text-transform: uppercase;
      }
      #timer-hint {
        position: absolute; bottom: 20px;
        font-size: 0.72rem; font-weight: 700;
        color: rgba(255,255,255,0.30);
        text-align: center; pointer-events: none;
      }
      #timer-modal {
        display: none; position: absolute; inset: 0;
        background: rgba(10,8,30,0.80);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 40;
        align-items: center; justify-content: center;
        padding: 20px;
      }
      #timer-modal.visible { display: flex; }
      #timer-modal-box {
        background: rgba(30,30,58,0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 28px; padding: 24px;
        width: 100%; max-width: 420px;
        display: flex; flex-direction: column; gap: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
      #timer-modal-header {
        display: flex; align-items: center;
        justify-content: space-between;
      }
      #timer-modal-header h3 { color: white; font-size: 1rem; font-weight: 900; }
      #btn-timer-cerrar {
        width: 32px; height: 32px; border-radius: 50%;
        border: none; background: rgba(255,255,255,0.1);
        color: white; font-size: 1rem; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background .15s;
      }
      #btn-timer-cerrar:active { background: rgba(255,255,255,0.2); }
      .timer-modal-label {
        color: rgba(255,255,255,0.45); font-size: 0.7rem;
        font-weight: 900; text-transform: uppercase; letter-spacing: .08em;
      }
      .timer-presets { display: flex; flex-wrap: wrap; gap: 8px; }
      .timer-preset {
        padding: 10px 16px; border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07); color: white;
        font-weight: 800; font-size: 0.85rem; cursor: pointer;
        transition: all .15s; font-family: inherit;
      }
      .timer-preset:active { background: rgba(255,255,255,0.18); transform: scale(0.95); }
      .timer-custom { display: flex; gap: 8px; align-items: flex-end; }
      .timer-custom-campo {
        flex: 1; display: flex; flex-direction: column;
        gap: 6px; align-items: center;
      }
      .timer-custom input {
        width: 100%; padding: 14px; border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07); color: white;
        font-size: 1.4rem; font-weight: 900; text-align: center;
        font-family: inherit; outline: none;
        -webkit-appearance: none;
      }
      .timer-custom input:focus { border-color: #F59E0B; }
      .timer-custom input::placeholder { color: rgba(255,255,255,0.2); }
      .timer-custom label { color: rgba(255,255,255,0.4); font-size: 0.75rem; font-weight: 700; }
      .timer-sep {
        color: rgba(255,255,255,0.4); font-size: 1.8rem;
        font-weight: 900; padding-bottom: 16px; flex-shrink: 0;
      }
      #btn-timer-iniciar {
        width: 100%; padding: 16px; border-radius: 18px;
        border: none; background: #F59E0B; color: white;
        font-size: 1.05rem; font-weight: 900; cursor: pointer;
        font-family: inherit; transition: transform .12s, filter .12s;
      }
      #btn-timer-iniciar:active { transform: scale(0.96); filter: brightness(0.9); }
      #timer-fin {
        display: none; position: absolute; inset: 0;
        flex-direction: column; align-items: center; justify-content: center;
        gap: 16px; pointer-events: none; z-index: 10;
      }
      #timer-fin.visible { display: flex; }
      #timer-fin-emoji { font-size: 6rem; animation: timer-pop .5s cubic-bezier(.34,1.56,.64,1); }
      #timer-fin-texto { color: white; font-size: 1.5rem; font-weight: 900; text-shadow: 0 2px 16px rgba(0,0,0,.7); }
      @keyframes timer-pop {
        from { transform: scale(0); opacity: 0; }
        to   { transform: scale(1); opacity: 1; }
      }
    </style>
    <div id="timer-wrap">
      <div id="timer-canvas-wrap">
        <canvas id="timer-canvas"></canvas>
        <div id="timer-display">
          <span id="timer-tiempo">--:--</span>
          <span id="timer-estado">Configura el tiempo</span>
        </div>
      </div>
      <p id="timer-hint">Toca la esfera para pausar o reanudar</p>
      <div id="timer-fin">
        <span id="timer-fin-emoji">&#9989;</span>
        <p id="timer-fin-texto">Tiempo terminado</p>
      </div>
      <div id="timer-modal">
        <div id="timer-modal-box">
          <div id="timer-modal-header">
            <h3>&#9201; Configurar tiempo</h3>
            <button id="btn-timer-cerrar">&#10005;</button>
          </div>
          <p class="timer-modal-label">Tiempo rapido</p>
          <div class="timer-presets" id="timer-presets"></div>
          <p class="timer-modal-label">Personalizado</p>
          <div class="timer-custom">
            <div class="timer-custom-campo">
              <input id="input-min" type="number" min="0" max="60" placeholder="0" inputmode="numeric">
              <label>minutos</label>
            </div>
            <span class="timer-sep">:</span>
            <div class="timer-custom-campo">
              <input id="input-seg" type="number" min="0" max="59" placeholder="0" inputmode="numeric">
              <label>segundos</label>
            </div>
          </div>
          <button id="btn-timer-iniciar">Iniciar</button>
        </div>
      </div>
    </div>
  `;

  _renderPresets();

  _q('#timer-canvas-wrap').addEventListener('click', () => {
    _getAudioCtx();
    if (!_corriendo && _msRestantes <= 0 && _totalMs > 0) return;
    if (_totalMs === 0) { _abrirConfig(); return; }
    if (_corriendo) _pausar();
    else _reanudar();
  });

  _q('#btn-timer-cerrar').addEventListener('click', _cerrarConfig);
  _q('#timer-modal').addEventListener('click', e => {
    if (e.target === _q('#timer-modal')) _cerrarConfig();
  });

  _q('#btn-timer-iniciar').addEventListener('click', () => {
    const min   = parseInt(_q('#input-min').value) || 0;
    const seg   = parseInt(_q('#input-seg').value) || 0;
    const total = min * 60 + seg;
    if (total <= 0) return;
    _iniciar(total * 1000);
    _cerrarConfig();
  });

  window.addEventListener('resize', _onResize);
}

function _onResize() { _ajustarCanvas(); }

function _renderPresets() {
  const wrap = _q('#timer-presets');
  if (!wrap) return;
  const presets = [
    { label: '1 min',  ms: 60000   },
    { label: '2 min',  ms: 120000  },
    { label: '5 min',  ms: 300000  },
    { label: '10 min', ms: 600000  },
    { label: '15 min', ms: 900000  },
    { label: '20 min', ms: 1200000 },
    { label: '30 min', ms: 1800000 },
  ];
  wrap.innerHTML = '';
  presets.forEach(p => {
    const btn = document.createElement('button');
    btn.className   = 'timer-preset';
    btn.textContent = p.label;
    btn.addEventListener('click', () => { _iniciar(p.ms); _cerrarConfig(); });
    wrap.appendChild(btn);
  });
}

function _abrirConfig() { _q('#timer-modal').classList.add('visible'); }
function _cerrarConfig() { _q('#timer-modal').classList.remove('visible'); }

function _ajustarCanvas() {
  const canvas = _q('#timer-canvas');
  if (!canvas) return;
  const wrap = _q('#timer-wrap');
  if (!wrap) return;
  const size = Math.min(wrap.offsetWidth * 0.85, wrap.offsetHeight * 0.80, 520);
  canvas.width  = Math.floor(size);
  canvas.height = Math.floor(size);
  _dibujar(_totalMs > 0 ? _msRestantes / _totalMs : 1);
}

// -- Control del temporizador ---

function _iniciar(totalMs) {
  _detener();
  _totalMs      = totalMs;
  _msRestantes  = totalMs;
  _tiempoInicio = performance.now();
  _tiempoFin    = _tiempoInicio + totalMs;
  _corriendo    = true;
  const fin = _q('#timer-fin');
  if (fin) fin.classList.remove('visible');
  _iniciarRAF();
}

function _pausar() {
  _msRestantes = Math.max(0, _tiempoFin - performance.now());
  _detener();
  _dibujar(_msRestantes / _totalMs);
}

function _reanudar() {
  if (_msRestantes <= 0) return;
  _detener();
  _tiempoInicio = performance.now();
  _tiempoFin    = _tiempoInicio + _msRestantes;
  _corriendo    = true;
  _iniciarRAF();
}

function _detener() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  _corriendo = false;
}

function _iniciarRAF() {
  if (_rafId) cancelAnimationFrame(_rafId);
  function loop() {
    if (!_corriendo) return;
    const ahora = performance.now();
    _msRestantes = Math.max(0, _tiempoFin - ahora);
    _dibujar(_msRestantes / _totalMs);
    if (_msRestantes <= 0) { _terminar(); return; }
    _rafId = requestAnimationFrame(loop);
  }
  _rafId = requestAnimationFrame(loop);
}

function _terminar() {
  _detener();
  _msRestantes = 0;
  _dibujar(0);
  _sonarFin();
  lanzarConfeti({ count: 60, container: _q('#timer-wrap') });
  const fin = _q('#timer-fin');
  if (fin) fin.classList.add('visible');
  TTS.speak('Tiempo terminado', { lang: 'es-MX', pitch: 1.2, rate: 0.9, delay: 800 });
  setTimeout(() => { if (!_container || !fin) return; fin.classList.remove('visible'); }, 4000);
}

function _sonarFin() {
  try {
    const ctx   = _getAudioCtx();
    const notas = [523.25, 659.25, 783.99, 1046.50];
    notas.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.18 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch(e) {}
}

// -- Formato de tiempo ---
function _formatTiempo() {
  if (_totalMs === 0) return '--:--';
  const totalSeg = Math.ceil(_msRestantes / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return String(min).padStart(2, '0') + ':' + String(seg).padStart(2, '0');
}

// ─────────────────────────────────────────────────────────────
//  DIBUJO  —  estilo imagen de referencia
//  Capas (abajo → arriba):
//  1. Bisel / sombra exterior
//  2. Cara blanca completa
//  3. Anillo "sol" amarillo (siempre visible bajo el arcoíris)
//  4. Anillo arcoíris concéntrico — se va consumiendo
//  5. Marcas de minuto (borde interior del anillo)
//  6. Números de colores en la cara blanca exterior
//  7. Borde de bisel
//  8. Hub central azul-gris
//  9. Texto MM:SS
// ─────────────────────────────────────────────────────────────
function _dibujar(progreso) {
  if (progreso === undefined) progreso = _totalMs > 0 ? _msRestantes / _totalMs : 1;
  const canvas = _q('#timer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  if (W <= 0 || H <= 0) return;
  const cx = W / 2;
  const cy = H / 2;
  ctx.clearRect(0, 0, W, H);

  // Geometría principal
  const RDisco  = W * 0.47;   // radio total de la cara
  const RAnOut  = W * 0.42;   // borde exterior del anillo arcoíris
  const RAnIn   = W * 0.195;  // borde interior del anillo arcoíris (= borde exterior del hub+cara)
  const RHub    = W * 0.115;  // botón central
  const grosorAnillo = RAnOut - RAnIn;

  // Colores del arcoíris de exterior a interior (igual que la foto)
  const BANDAS = [
    '#EF4444', // rojo
    '#F97316', // naranja
    '#EAB308', // amarillo-naranja
    '#22C55E', // verde
    '#3B82F6', // azul
    '#8B5CF6', // violeta
  ];

  // Colores de los números por posición (rotan con el arcoíris)
  const NUM_COLORS = [
    '#EF4444', '#F97316', '#EAB308',
    '#22C55E', '#3B82F6', '#8B5CF6',
    '#EF4444', '#F97316', '#EAB308',
    '#22C55E', '#3B82F6', '#8B5CF6',
  ];

  // Ángulos: 12 en punto = -PI/2, sentido horario
  const ANG0    = -Math.PI / 2;
  const angFin  = ANG0 + progreso * Math.PI * 2; // fin del arco activo

  // ── 1. Sombra / bisel ──
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur    = W * 0.045;
  ctx.shadowOffsetY = W * 0.012;
  ctx.beginPath();
  ctx.arc(cx, cy, RDisco, 0, Math.PI * 2);
  ctx.fillStyle = '#dce8f0';  // azul-gris claro como la foto
  ctx.fill();
  ctx.restore();

  // ── 2. Cara blanca ──
  ctx.beginPath();
  ctx.arc(cx, cy, RDisco * 0.97, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // ── 3. Anillo "sol" amarillo — siempre completo debajo ──
  // Se dibuja como anillo completo (donut); es lo que queda expuesto
  // cuando el arcoíris se consume
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, RAnOut, 0, Math.PI * 2);
  ctx.arc(cx, cy, RAnIn, 0, Math.PI * 2, true); // agujero
  ctx.fillStyle = '#FCD34D';  // amarillo cálido
  ctx.fill('evenodd');
  ctx.restore();

  // Segundo pase: gradiente radial sobre el amarillo para darle volumen solar
  ctx.save();
  var solGrad = ctx.createRadialGradient(cx, cy - RAnIn * 0.3, RAnIn * 0.5, cx, cy, RAnOut);
  solGrad.addColorStop(0,   'rgba(255,255,255,0.35)');
  solGrad.addColorStop(0.4, 'rgba(251,191,36,0.0)');
  solGrad.addColorStop(1,   'rgba(180,83,9,0.18)');
  ctx.beginPath();
  ctx.arc(cx, cy, RAnOut, 0, Math.PI * 2);
  ctx.arc(cx, cy, RAnIn, 0, Math.PI * 2, true);
  ctx.fillStyle = solGrad;
  ctx.fill('evenodd');
  ctx.restore();

  // ── 4. Anillo arcoíris — sector activo (tiempo restante) ──
  // Dibujamos N bandas concéntricas, cada una como arco desde ANG0 hasta angFin
  if (progreso > 0.002) {
    var nBandas = BANDAS.length;
    var grosorBanda = grosorAnillo / nBandas;
    for (var bi = 0; bi < nBandas; bi++) {
      // exterior a interior: banda 0 = rojo (más exterior)
      var rExt = RAnOut - bi * grosorBanda;
      var rInt = RAnOut - (bi + 1) * grosorBanda;
      var rMed = (rExt + rInt) / 2;
      var lw   = grosorBanda * 0.92; // pequeña separación entre bandas

      ctx.save();
      ctx.beginPath();
      // Dibujar sector como stroke de arco
      ctx.arc(cx, cy, rMed, ANG0, angFin);
      ctx.strokeStyle = BANDAS[bi];
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'butt';
      ctx.stroke();
      ctx.restore();
    }

    // Brillo sutil encima de todo el anillo (capa de lustre)
    ctx.save();
    var lustreGrad = ctx.createLinearGradient(cx, cy - RAnOut, cx, cy + RAnOut);
    lustreGrad.addColorStop(0,   'rgba(255,255,255,0.22)');
    lustreGrad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    lustreGrad.addColorStop(1,   'rgba(0,0,0,0.08)');
    for (var bi2 = 0; bi2 < nBandas; bi2++) {
      var rExt2 = RAnOut - bi2 * grosorBanda;
      var rInt2 = RAnOut - (bi2 + 1) * grosorBanda;
      var rMed2 = (rExt2 + rInt2) / 2;
      var lw2   = grosorBanda * 0.92;
      ctx.beginPath();
      ctx.arc(cx, cy, rMed2, ANG0, angFin);
      ctx.strokeStyle = lustreGrad;
      ctx.lineWidth   = lw2;
      ctx.lineCap     = 'butt';
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── 5. Marcas de minuto — en el borde interior del anillo ──
  ctx.save();
  for (var tick = 0; tick < 60; tick++) {
    var angTick  = (tick / 60) * Math.PI * 2 + ANG0;
    var esMayor  = tick % 5 === 0;
    var rTickOut = RAnIn + grosorAnillo * 0.12;
    var rTickIn  = RAnIn - (esMayor ? W * 0.025 : W * 0.012);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angTick) * rTickIn,  cy + Math.sin(angTick) * rTickIn);
    ctx.lineTo(cx + Math.cos(angTick) * rTickOut, cy + Math.sin(angTick) * rTickOut);
    ctx.strokeStyle = esMayor ? 'rgba(0,0,0,0.50)' : 'rgba(0,0,0,0.20)';
    ctx.lineWidth   = esMayor ? W * 0.006 : W * 0.003;
    ctx.stroke();
  }
  ctx.restore();

  // ── 6. Números de colores en la cara blanca ──
  // 12 etiquetas (5, 10, 15, … 55, 00) en el anillo exterior de la cara
  var numData = [
    { val: 5,  idx: 0  },
    { val: 10, idx: 1  },
    { val: 15, idx: 2  },
    { val: 20, idx: 3  },
    { val: 25, idx: 4  },
    { val: 30, idx: 5  },
    { val: 35, idx: 6  },
    { val: 40, idx: 7  },
    { val: 45, idx: 8  },
    { val: 50, idx: 9  },
    { val: 55, idx: 10 },
    { val: 0,  idx: 11 },
  ];
  // Radio donde van los números: entre el borde exterior del anillo y el borde del disco
  var rNum     = RAnOut + (RDisco * 0.97 - RAnOut) * 0.52;
  var fszOuter = Math.round(W * 0.052);
  ctx.save();
  ctx.font         = 'bold ' + fszOuter + 'px system-ui, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  numData.forEach(function(nd) {
    var angNum = (nd.val / 60) * Math.PI * 2 + ANG0;
    var tx = cx + Math.cos(angNum) * rNum;
    var ty = cy + Math.sin(angNum) * rNum;
    ctx.fillStyle = NUM_COLORS[nd.idx];
    ctx.fillText(nd.val === 0 ? '00' : String(nd.val), tx, ty);
  });
  ctx.restore();

  // ── 7. Borde de bisel ──
  ctx.beginPath();
  ctx.arc(cx, cy, RDisco * 0.97, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(160,190,210,0.8)';
  ctx.lineWidth   = W * 0.022;
  ctx.stroke();
  // Línea interior del bisel
  ctx.beginPath();
  ctx.arc(cx, cy, RDisco * 0.97 - W * 0.012, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth   = W * 0.006;
  ctx.stroke();

  // ── 8. Hub central azul-gris ──
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur    = W * 0.03;
  ctx.shadowOffsetY = W * 0.01;
  // Base del hub (círculo ligeramente más grande, bisel)
  var hubBiselGrad = ctx.createRadialGradient(
    cx - RHub * 0.15, cy - RHub * 0.2, RHub * 0.1,
    cx, cy, RHub * 1.15
  );
  hubBiselGrad.addColorStop(0, '#e0eaf2');
  hubBiselGrad.addColorStop(1, '#8aa8bf');
  ctx.beginPath();
  ctx.arc(cx, cy, RHub * 1.15, 0, Math.PI * 2);
  ctx.fillStyle = hubBiselGrad;
  ctx.fill();
  ctx.restore();

  // Cara del hub
  ctx.save();
  var hubGrad = ctx.createRadialGradient(
    cx - RHub * 0.25, cy - RHub * 0.30, RHub * 0.05,
    cx + RHub * 0.1,  cy + RHub * 0.1,  RHub
  );
  hubGrad.addColorStop(0,    '#d6e8f5');
  hubGrad.addColorStop(0.45, '#b0cfe0');
  hubGrad.addColorStop(1,    '#7a9fba');
  ctx.beginPath();
  ctx.arc(cx, cy, RHub, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.restore();

  // Brillo del hub (reflejo superior)
  ctx.save();
  var hubBrilloGrad = ctx.createRadialGradient(
    cx - RHub * 0.28, cy - RHub * 0.32, 0,
    cx - RHub * 0.28, cy - RHub * 0.32, RHub * 0.68
  );
  hubBrilloGrad.addColorStop(0,   'rgba(255,255,255,0.55)');
  hubBrilloGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  hubBrilloGrad.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, RHub, 0, Math.PI * 2);
  ctx.fillStyle = hubBrilloGrad;
  ctx.fill();
  ctx.restore();

  // ── 9. Texto MM:SS ──
  const tiempo = _q('#timer-tiempo');
  const estado = _q('#timer-estado');
  if (tiempo) tiempo.textContent = _formatTiempo();
  if (estado) {
    if (_totalMs === 0)          estado.textContent = 'Toca para configurar';
    else if (_corriendo)         estado.textContent = 'En curso';
    else if (_msRestantes <= 0)  estado.textContent = 'Terminado';
    else                         estado.textContent = 'Pausado';
  }
}