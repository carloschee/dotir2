import { init, destroy, onEnter, onLeave, pause, resume } from './videos.js';

async function _buildCache() {
  try {
    const r = await fetch('./data/videos.json');
    if (!r.ok) return [];
    const videos = await r.json();
    const urls = ['./data/videos.json', './modules/videos/videos.js'];
    videos.forEach(v => {
      urls.push('./assets/videos/' + v.archivo + '.mp4');
      urls.push('./assets/videos/img/' + v.archivo + '.jpg');
    });
    return urls;
  } catch { return []; }
}

export default {
  id: 'videos', label: 'Videos', desc: 'Reproductor video',
  emoji: '\u{1F3AC}', color: '#EF4444', orden: 6,
  habilitado: true, requierePin: false,
  init, destroy, onEnter, onLeave, pause, resume,
  cache: [],
  async buildCache() { this.cache = await _buildCache(); return this.cache; },
};
