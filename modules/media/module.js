import { init, destroy, onEnter, onLeave, pause, resume } from './media.js';

export default {
  id:          'media',
  label:       'Multimedia',
  desc:        'Musica y videos',
  emoji:       '\u25B6\uFE0F',
  color:       '#7C3AED',
  orden:       3,
  habilitado:  true,
  requierePin: false,
  init, destroy, onEnter, onLeave, pause, resume,
  cache: ['./data/media.json'],
};