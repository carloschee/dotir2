import { init, destroy, onEnter, onLeave, pause, resume } from './videos.js';

export default {
  id:          'videos',
  label:       'Videos',
  desc:        'Reproductor video',
  emoji:       '🎬',
  color:       '#EF4444',
  orden:       5,
  habilitado:  true,
  requierePin: false,
  init,
  destroy,
  onEnter,
  onLeave,
  pause,
  resume,
  cache: [
    './data/videos.json',
  ],
};
