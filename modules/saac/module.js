import { init, destroy, onEnter, onLeave, pause, resume, setTamano, getTamano } from './saac.js';

export default {
  id: 'saac', label: 'Comunicador', desc: 'Tablero SAAC',
  emoji: '\u{1F4AC}', color: '#4A90E2',
  orden: 1, habilitado: true, requierePin: false,
  init, destroy, onEnter, onLeave, pause, resume,
  setTamano, getTamano,
  cache: ['./data/saac.json'],
};
