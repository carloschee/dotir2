import { init, destroy, onEnter, onLeave, pause, resume } from './musica.js';

async function _buildCache() {
  try {
    const r = await fetch('./data/audios.json');
    if (!r.ok) return [];
    const canciones = await r.json();
    const urls = ['./data/audios.json', './modules/musica/musica.js'];
    canciones.forEach(c => {
      urls.push('./assets/audio/' + c.archivo + '.mp3');
      urls.push('./assets/audio/img/' + c.archivo + '.jpg');
    });
    return urls;
  } catch { return []; }
}

export default {
  id: 'musica', label: 'Musica', desc: 'Reproductor',
  emoji: '\u{1F3B5}', color: '#EC4899', orden: 3,
  habilitado: true, requierePin: false,
  init, destroy, onEnter, onLeave, pause, resume,
  cache: [], // se rellena dinamicamente abajo
  async buildCache() { this.cache = await _buildCache(); return this.cache; },
};
