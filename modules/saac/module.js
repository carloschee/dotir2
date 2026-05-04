/* ============================================================
   Dótir 2 — modules/saac/module.js
   Descriptor del módulo SAAC para el MODULE_REGISTRY.
   Solo toca este archivo para cambiar metadatos del módulo
   (orden, color del tile, si requiere PIN, etc.)
   ============================================================ */

import { init, destroy, onEnter, onLeave } from './saac.js';

export default {
  // ── Identidad ──────────────────────────────────────────────
  id:          'saac',
  label:       'Comunicador',
  desc:        'Tablero SAAC',
  emoji:       '💬',
  color:       '#4A90E2',   // color del tile en el menú principal

  // ── Comportamiento ─────────────────────────────────────────
  orden:       1,           // posición en el menú (menor = primero)
  habilitado:  true,        // false = oculto sin borrar código
  requierePin: false,

  // ── Ciclo de vida ──────────────────────────────────────────
  init,       // async (container: HTMLElement) → void
  destroy,    // () → void   — limpia listeners, libera memoria
  onEnter,    // () → void   — se ejecuta al navegar hacia aquí
  onLeave,    // () → void   — se ejecuta al salir (detiene TTS)

  // ── Recursos a precachear para uso offline ─────────────────
  // El SW descargará estos archivos cuando la usuaria
  // active "Descargar para usar sin internet" en Ajustes.
  cache: [
    './data/saac.json',
    // Los PNGs de assets/pics/ se añaden dinámicamente
    // al leer el JSON (ver core/offline.js → precachear)
  ],
};
