/* ============================================================
   Dótir 2 — modules/memorama/module.js
   Descriptor del módulo Memorama para el MODULE_REGISTRY.
   ============================================================ */

import { init, destroy, onEnter, onLeave } from './memorama.js';

export default {
  id:          'memorama',
  label:       'Memorama',
  desc:        'Juego de memoria',
  emoji:       '🃏',
  color:       '#7B61FF',

  orden:       2,
  habilitado:  true,
  requierePin: false,

  init,
  destroy,
  onEnter,
  onLeave,

  // Recursos a precachear para uso offline.
  // Los JSONs de cada tema y sus imágenes se añaden
  // dinámicamente al leer memorama-temas.json (ver core/offline.js).
  cache: [
    './data/memorama-temas.json',
    './data/memorama-frutas.json',
    './data/memorama-transportes.json',
    './data/memorama-vegetales.json',
  ],
};