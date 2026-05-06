/* Dotir 2 - modules/temporizador/temporizador.js */

import { TTS } from '../../core/tts.js';
import { lanzarConfeti } from '../../core/ui.js';

const LS_MODO = 'dotir2-timer-modo';

let _container     = null;
let _totalSeg      = 0;
let _restaSeg      = 0;
let _corriendo     = false;
let _intervalo     = null;
let _modo          = localStorage.getItem(LS_MODO) || 'min';
let _configAbierta = false;

const _q = sel => _container?.querySelector(sel);

export async function init(container) {
  _container = container;
  _renderShell();
  _renderNavAcciones();
  _ajustarCanvas();
}

export function destroy() {
  _detener();
  _container = null;
  window.removeEventListener('resize', _ajustarCanvas);
  document.getElementById('modulo-acciones')?.replaceChildren();
  document.getElementById('timer-nav-style')?.remove();
}

export function onEnter() {
  _ajustarCanvas();
}

export function onLeave() {
  _detener();
}

export function pause() {
  if (_corriendo) _pausar();
  document.getElementById('modulo-acciones')?.replaceChildren();
}

export async function resume(container) {
  _container = container;
  _renderNavAcciones();
  _ajustarCanvas();
}

function _renderNavAcciones() {
  const acc = document.getElementById('modulo-acciones');
  if (!acc) return;
  acc.innerHTML = '';

  if (!document.getElementById('timer-nav-style')) {
    const s = document.createElement('style');
    s.id = 'timer-nav-style';
    s.textContent =
      '.timer-modo-btn{display:flex;align-items:center;justify-content:center;' +
      'height:28px;padding:0 10px;border-radius:10px;' +
      'border:1.5px solid rgba(255,255,255,0.25);' +
      'background:rgba(255,255,255,0.12);color:white;' +
      'font-size:0.72rem;font-weight:800;cursor:pointer;transition:all .15s;}' +
      '.timer-modo-btn.activo{background:rgba(255,255,255,0.30);border-color:white;}';
    document.head.appendChild(s);
  }

  const btnMin = document.createElement('button');
  btnMin.className = 'timer-modo-btn' + (_modo === 'min' ? ' activo' : '');
  btnMin.textContent = 'Min';
  btnMin.addEventListener('click', () => _setModo('min'));

  const btnSeg = document.createElement('button');
  btnSeg.className = 'timer-modo-btn' + (_modo === 'seg' ? ' activo' : '');
  btnSeg.textContent = 'Min+Seg';
  btnSeg.addEventListener('click', () => _setModo('seg'));

  const btnConfig = document.createElement('button');
  btnConfig.className = 'd-nav-btn';
  btnConfig.textContent = '\u23F1 Configurar';
  btnConfig.addEventListener('click', _toggleConfig);

  acc.append(btnMin, btnSeg, btnConfig);
}

function _setModo(m) {
  _modo = m;
  localStorage.setItem(LS_MODO, m);
  _renderNavAcciones();
  _dibujar();
}

function _renderShell() {
  _container.innerHTML = `
    <style>
      #timer-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow: hidden;
        background: transparent;
        align-items: center; justify-content: center;
        gap: 16px; padding: 16px;
        position: relative;
      }

      #timer-canvas-wrap {
        position: relative;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        user-select: none; -webkit-user-select: none;
        width: min(70vw, 70vh, 480px);
        height: min(70vw, 70vh, 480px);
        flex-shrink: 0;
      }

      #timer-canvas {
        border-radius: 50%;
        filter: drop-shadow(0 8px 32px rgba(0,0,0,0.4));
        touch-action: none;
      }

      #timer-display {
        position: absolute;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        pointer-events: none;
      }
      #timer-tiempo {
        font-size: clamp(2rem, 6vw, 3.5rem);
        font-weight: 900; color: white;
        text-shadow: 0 2px 12px rgba(0,0,0,0.6);
        letter-spacing: -1px; line-height: 1;
      }
      #timer-estado {
        font-size: clamp(0.7rem, 2vw, 0.9rem);
        font-weight: 700; color: rgba(255,255,255,0.6);
        margin-top: 4px; letter-spacing: .05em;
        text-transform: uppercase;
      }

      #timer-hint {
        font-size: 0.75rem; font-weight: 700;
        color: rgba(255,255,255,0.35);
        text-align: center; flex-shrink: 0;
      }

      #timer-config {
        display: none; flex-direction: column; gap: 14px;
        background: rgba(0,0,0,0.45);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 24px; padding: 20px;
        width: 100%; max-width: 400px;
        flex-shrink: 0;
      }
      #timer-config.visible { display: flex; }

      #timer-config p {
        color: rgba(255,255,255,0.5); font-size: 0.72rem;
        font-weight: 900; text-transform: uppercase; letter-spacing: .08em;
      }

      .timer-presets {
        display: flex; flex-wrap: wrap; gap: 8px;
      }
      .timer-preset {
        padding: 10px 16px; border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08); color: white;
        font-weight: 800; font-size: 0.85rem; cursor: pointer;
        transition: all .15s; font-family: inherit;
      }
      .timer-preset:active { background: rgba(255,255,255,0.2); transform: scale(0.95); }

      .timer-custom {
        display: flex; gap: 8px; align-items: flex-end;
      }
      .timer-custom-campo {
        flex: 1; display: flex; flex-direction: column;
        gap: 4px; align-items: center;
      }
      .timer-custom input {
        width: 100%; padding: 12px; border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08); color: white;
        font-size: 1.2rem; font-weight: 900; text-align: center;
        font-family: inherit; outline: none;
        -webkit-appearance: none;
      }
      .timer-custom input:focus { border-color: #F59E0B; }
      .timer-custom input::placeholder { color: rgba(255,255,255,0.25); }
      .timer-custom label {
        color: rgba(255,255,255,0.5); font-size: 0.75rem; font-weight: 700;
      }
      .timer-sep {
        color: white; font-size: 1.5rem; font-weight: 900;
        padding-bottom: 14px; flex-shrink: 0;
      }

      #btn-timer-iniciar {
        width: 100%; padding: 14px; border-radius: 16px;
        border: none; background: #F59E0B; color: white;
        font-size: 1rem; font-weight: 900; cursor: pointer;
        font-family: inherit; transition: transform .12s;
      }
      #btn-timer-iniciar:active { transform: scale(0.96); }

      #timer-fin {
        display: none; position: absolute; inset: 0;
        flex-direction: column; align-items: center; justify-content: center;
        gap: 16px; pointer-events: none; z-index: 10;
      }
      #timer-fin.visible { display: flex; }
      #timer-fin-emoji {
        font-size: 5rem;
        animation: timer-pop .5s cubic-bezier(.34,1.56,.64,1);
      }
      #timer-fin-texto {
        color: white; font-size: 1.4rem; font-weight: 900;
        text-shadow: 0 2px 12px rgba(0,0,0,.6);
      }

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

      <div id="timer-config">
        <p>Tiempo rapido</p>
        <div class="timer-presets" id="timer-presets"></div>
        <p>Tiempo personalizado</p>
        <div class="timer-custom">
          <div class="timer-custom-campo">
            <input id="input-min" type="number" min="0" max="60"
                   placeholder="0" inputmode="numeric">
            <label>min</label>
          </div>
          <span class="timer-sep">:</span>
          <div class="timer-custom-campo">
            <input id="input-seg" type="number" min="0" max="59"
                   placeholder="0" inputmode="numeric">
            <label>seg</label>
          </div>
        </div>
        <button id="btn-timer-iniciar">Iniciar</button>
      </div>

      <div id="timer-fin">
        <span id="timer-fin-emoji">&#9989;</span>
        <p id="timer-fin-texto">Tiempo terminado</p>
      </div>
    </div>
  `;

  _renderPresets();

  _q('#timer-canvas-wrap').addEventListener('click', () => {
    if (_totalSeg === 0) return;
    if (_corriendo) _pausar();
    else _reanudar();
  });

  _q('#btn-timer-iniciar').addEventListener('click', () => {
    const min   = parseInt(_q('#input-min').value) || 0;
    const seg   = parseInt(_q('#input-seg').value) || 0;
    const total = min * 60 + seg;
    if (total <= 0) return;
    _iniciar(total);
    _toggleConfig();
  });

  window.addEventListener('resize', _onResize);
}

function _onResize() { _ajustarCanvas(); }

function _renderPresets() {
  const wrap = _q('#timer-presets');
  if (!wrap) return;
  const presets = [
    { label: '1 min',  seg: 60   },
    { label: '2 min',  seg: 120  },
    { label: '5 min',  seg: 300  },
    { label: '10 min', seg: 600  },
    { label: '15 min', seg: 900  },
    { label: '20 min', seg: 1200 },
    { label: '30 min', seg: 1800 },
  ];
  wrap.innerHTML = '';
  presets.forEach(p => {
    const btn = document.createElement('button');
    btn.className   = 'timer-preset';
    btn.textContent = p.label;
    btn.addEventListener('click', () => { _iniciar(p.seg); _toggleConfig(); });
    wrap.appendChild(btn);
  });
}

function _toggleConfig() {
  _configAbierta = !_configAbierta;
  _q('#timer-config').classList.toggle('visible', _configAbierta);
  _q('#timer-hint').style.display = _configAbierta ? 'none' : '';
}

function _ajustarCanvas() {
  const canvas = _q('#timer-canvas');
  if (!canvas) return;
  const wrap = _q('#timer-wrap');
  if (!wrap) return;
  const size = Math.min(
    wrap.offsetWidth  * 0.85,
    wrap.offsetHeight * 0.75,
    500
  );
  canvas.width  = Math.floor(size);
  canvas.height = Math.floor(size);
  _dibujar();
}

function _iniciar(totalSeg) {
  _detener();
  _totalSeg  = totalSeg;
  _restaSeg  = totalSeg;
  _corriendo = true;
  const fin = _q('#timer-fin');
  if (fin) fin.classList.remove('visible');
  _dibujar();
  _intervalo = setInterval(() => {
    if (!_corriendo) return;
    _restaSeg--;
    _dibujar();
    if (_restaSeg <= 0) _terminar();
  }, 1000);
}

function _pausar() {
  _corriendo = false;
  _dibujar();
}

function _reanudar() {
  if (_restaSeg <= 0) return;
  _corriendo = true;
  _dibujar();
  _intervalo = setInterval(() => {
    if (!_corriendo) return;
    _restaSeg--;
    _dibujar();
    if (_restaSeg <= 0) _terminar();
  }, 1000);
}

function _detener() {
  clearInterval(_intervalo);
  _intervalo = null;
  _corriendo = false;
  window.removeEventListener('resize', _onResize);
}

function _terminar() {
  _detener();
  _restaSeg = 0;
  _dibujar();
  _sonarFin();
  lanzarConfeti({ count: 60, container: _q('#timer-wrap') });
  const fin = _q('#timer-fin');
  if (fin) fin.classList.add('visible');
  TTS.speak('Tiempo terminado', { lang: 'es-MX', pitch: 1.2, rate: 0.9, delay: 800 });
  setTimeout(() => { if (fin) fin.classList.remove('visible'); }, 4000);
}

function _sonarFin() {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
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

function _formatTiempo() {
  if (_totalSeg === 0) return '--:--';
  const min = Math.floor(_restaSeg / 60);
  const seg = _restaSeg % 60;
  if (_modo === 'min') return min + ' min';
  return String(min).padStart(2, '0') + ':' + String(seg).padStart(2, '0');
}

function _dibujar() {
  const canvas = _q('#timer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;
  const cx  = W / 2;
  const cy  = H / 2;
  const R   = W * 0.46;
  const Ri  = W * 0.30;
  const lw  = R - Ri;

  ctx.clearRect(0, 0, W, H);

  // Fondo esfera
  const bgGrad = ctx.createRadialGradient(cx, cy - R * 0.15, R * 0.05, cx, cy, R);
  bgGrad.addColorStop(0, '#2a2a4a');
  bgGrad.addColorStop(1, '#0d0d1e');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth   = W * 0.010;
  ctx.stroke();

  // Marcas
  for (let i = 0; i < 60; i++) {
    const ang   = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const mayor = i % 5 === 0;
    const r1    = R * (mayor ? 0.86 : 0.91);
    const r2    = R * 0.96;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
    ctx.strokeStyle = mayor ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = mayor ? W * 0.007 : W * 0.003;
    ctx.stroke();
  }

  // Numeros
  ctx.font         = 'bold ' + (W * 0.052) + 'px system-ui';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 12; i++) {
    const num = i * 5;
    const ang = (num / 60) * Math.PI * 2 - Math.PI / 2;
    const r   = R * 0.76;
    ctx.fillText(String(num), cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
  }

  // Arco de arcoiris
  if (_totalSeg > 0) {
    const progreso  = Math.max(0, _restaSeg / _totalSeg);
    const angInicio = -Math.PI / 2;
    const angFin    = angInicio + progreso * Math.PI * 2;
    const arcR      = (R + Ri) / 2;
    const colores   = [
      '#EF4444',
      '#F97316',
      '#EAB308',
      '#22C55E',
      '#3B82F6',
      '#8B5CF6',
    ];
    const totalAng  = progreso * Math.PI * 2;
    const segmentos = colores.length;

    // Fondo gris del arco completo
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, angInicio, angInicio + Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'butt';
    ctx.stroke();

    // Segmentos de color
    ctx.shadowColor = 'rgba(255,255,255,0.12)';
    ctx.shadowBlur  = lw * 0.5;
    for (let s = 0; s < segmentos; s++) {
      const a0 = angInicio + (s / segmentos) * totalAng;
      const a1 = angInicio + ((s + 1) / segmentos) * totalAng;
      if (a1 <= a0) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, a0, a1);
      ctx.strokeStyle = colores[s];
      ctx.lineWidth   = lw * 0.85;
      ctx.lineCap     = 'butt';
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Separadores
    if (progreso > 0.02) {
      for (let s = 1; s < segmentos; s++) {
        const ang = angInicio + (s / segmentos) * totalAng;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * Ri, cy + Math.sin(ang) * Ri);
        ctx.lineTo(cx + Math.cos(ang) * R,  cy + Math.sin(ang) * R);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth   = W * 0.004;
        ctx.stroke();
      }
    }

    // Indicador punta
    if (progreso > 0.01) {
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(angFin) * arcR,
        cy + Math.sin(angFin) * arcR,
        lw * 0.52, 0, Math.PI * 2
      );
      ctx.fillStyle   = 'white';
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur  = lw * 0.5;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }
  }

  // Hub interior
  const hubGrad = ctx.createRadialGradient(cx, cy - Ri * 0.08, Ri * 0.04, cx, cy, Ri * 0.98);
  hubGrad.addColorStop(0, '#252540');
  hubGrad.addColorStop(1, '#0a0a18');
  ctx.beginPath();
  ctx.arc(cx, cy, Ri, 0, Math.PI * 2);
  ctx.fillStyle   = hubGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth   = W * 0.005;
  ctx.stroke();

  // Boton central
  const hubBtn = ctx.createRadialGradient(cx, cy - Ri * 0.15, Ri * 0.02, cx, cy, Ri * 0.35);
  hubBtn.addColorStop(0, '#3a3a5c');
  hubBtn.addColorStop(1, '#1a1a2e');
  ctx.beginPath();
  ctx.arc(cx, cy, Ri * 0.22, 0, Math.PI * 2);
  ctx.fillStyle   = hubBtn;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth   = W * 0.005;
  ctx.stroke();

  // Texto
  const tiempo = _q('#timer-tiempo');
  const estado = _q('#timer-estado');
  if (tiempo) tiempo.textContent = _formatTiempo();
  if (estado) {
    if (_totalSeg === 0)     estado.textContent = 'Configura el tiempo';
    else if (_corriendo)     estado.textContent = 'En curso';
    else if (_restaSeg <= 0) estado.textContent = 'Terminado';
    else                     estado.textContent = 'Pausado';
  }
}
