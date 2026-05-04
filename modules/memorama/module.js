import { init, destroy, onEnter, onLeave, pause, resume } from './memorama.js';

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
  pause,
  resume,
  cache: [
    './data/memorama-temas.json',
    './data/memorama-frutas.json',
    './data/memorama-transportes.json',
    './data/memorama-vegetales.json',
  ],
};
