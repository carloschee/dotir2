/* Dotir 2 - modules/temporizador/module.js */

import { init, destroy, onEnter, onLeave, pause, resume } from './temporizador.js';

export default {
  id:          'temporizador',
  label:       'Temporizador',
  desc:        'Cuenta regresiva',
  emoji:       '\u23F1',
  color:       '#F59E0B',
  orden:       6,
  habilitado:  true,
  requierePin: false,
  init,
  destroy,
  onEnter,
  onLeave,
  pause,
  resume,
  cache: [],
};
