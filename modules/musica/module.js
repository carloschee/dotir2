import { init, destroy, onEnter, onLeave, pause, resume } from './musica.js';

export default {
  id:          'musica',
  label:       'Musica',
  desc:        'Reproductor',
  emoji:       '🎵',
  color:       '#F5A623',
  orden:       3,
  habilitado:  true,
  requierePin: false,
  init,
  destroy,
  onEnter,
  onLeave,
  pause,
  resume,
  cache: [
    './data/audios.json',
  ],
};
