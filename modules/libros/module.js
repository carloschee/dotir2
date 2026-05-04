import { init, destroy, onEnter, onLeave, pause, resume } from './libros.js';

export default {
  id:          'libros',
  label:       'Libros',
  desc:        'Visor PDF',
  emoji:       '📚',
  color:       '#10B981',
  orden:       4,
  habilitado:  true,
  requierePin: false,
  init,
  destroy,
  onEnter,
  onLeave,
  pause,
  resume,
  cache: ['./data/libros.json'],
};
