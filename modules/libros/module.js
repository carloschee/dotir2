import { init, destroy, onEnter, onLeave, pause, resume } from './libros.js';

async function _buildCache() {
  try {
    const r = await fetch('./data/libros.json');
    if (!r.ok) return [];
    const libros = await r.json();
    const urls = ['./data/libros.json', './modules/libros/libros.js'];
    libros.forEach(l => {
      urls.push('./assets/libros/' + l.archivo + '.pdf');
      urls.push('./assets/libros/img/' + l.archivo + '.jpg');
    });
    return urls;
  } catch { return []; }
}

export default {
  id: 'libros', label: 'Libros', desc: 'Visor PDF',
  emoji: '\u{1F4DA}', color: '#10B981', orden: 5,
  habilitado: true, requierePin: false,
  init, destroy, onEnter, onLeave, pause, resume,
  cache: [],
  async buildCache() { this.cache = await _buildCache(); return this.cache; },
};
