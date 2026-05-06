import { init, destroy, onEnter, onLeave, pause, resume } from './temporizador.js';

export default {
  id:          'temporizador',
  label:       'Temporizador',
  desc:        'Timer visual',
  emoji:       '\u23F0',
  color:       '#F59E0B',
  orden:       4,
  habilitado:  true,
  requierePin: false,
  init, destroy, onEnter, onLeave, pause, resume,
  cache: [],
};
