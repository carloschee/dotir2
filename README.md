# Dótir 2

**Herramienta modular de comunicación aumentativa, aprendizaje y multimedia para infancias neurodivergentes.**

Dótir 2 es una Progressive Web App (PWA) diseñada para funcionar en tabletas, teléfonos y computadoras, con soporte completo para uso sin conexión a internet. Está orientada a terapeutas, educadores y familias que trabajan con niñas y niños con necesidades de comunicación aumentativa y alternativa (CAA/SAAC).

🔗 **Demo en vivo:** [carloschee.github.io/dotir2](https://carloschee.github.io/dotir2)

---

## Módulos

| Módulo | Descripción |
|---|---|
| 💬 **Comunicador** | Tablero SAAC con pictogramas ARASAAC, síntesis de voz, favoritos, historial de frases y búsqueda |
| 🃏 **Memorama** | Juego de pares con temas (frutas, transportes, vegetales), TTS multiidioma y animaciones |
| 🎵 **Música** | Reproductor de audio |
| 🎬 **Videos** | Reproductor de video |
| 📚 **Libros** | Visor de libros digitales |
| ⏱️ **Temporizador** | Cuenta regresiva visual con arcos de colores, presets y animación fluida a 60fps |
| ⚙️ **Ajustes** | Configuración general, descarga para uso offline, estado de conexión |

---

## Características técnicas

- **PWA instalable** — funciona como app nativa en iOS, Android y escritorio
- **100% offline** — Service Worker con caché configurable desde Ajustes
- **Sin dependencias** — Vanilla JS con ES Modules, sin frameworks ni bundlers
- **Síntesis de voz (TTS)** — motor compartido con soporte multiidioma y desbloqueo automático en iOS
- **Arquitectura modular** — cada módulo es independiente con ciclo de vida propio (`init`, `destroy`, `onEnter`, `onLeave`, `pause`, `resume`)
- **Diseño responsivo** — optimizado para tableta en orientación horizontal y vertical
- **Acceso con PIN** — módulo de Ajustes protegido por PIN configurable

---

## Estructura del proyecto

```
dotir2/
├── index.html              # Shell principal y MODULE_REGISTRY
├── manifest.json           # Configuración PWA
├── sw.js                   # Service Worker
├── core/
│   ├── tts.js              # Motor de síntesis de voz compartido
│   ├── ui.js               # Utilidades UI (confeti, toast, animaciones)
│   └── offline.js          # SW registration, precaché, estado de conexión
├── modules/
│   ├── saac/               # Comunicador SAAC
│   ├── memorama/           # Juego de memoria
│   ├── musica/             # Reproductor de música
│   ├── videos/             # Reproductor de video
│   ├── libros/             # Visor de libros
│   ├── temporizador/       # Temporizador visual
│   └── ajustes/            # Panel de configuración
├── data/
│   ├── saac.json           # Vocabulario y categorías del comunicador
│   ├── memorama-temas.json # Temas disponibles para memorama
│   └── memorama-*.json     # Datos de cada tema
└── assets/
    ├── pics/               # Pictogramas ARASAAC
    ├── img/                # Iconos PWA y capturas
    └── ui/                 # Capturas para el manifest
```

---

## Agregar un nuevo módulo

1. Crear la carpeta `modules/mi-modulo/`
2. Crear `mi-modulo.js` con las funciones exportadas:

```js
export async function init(container) { /* montar UI */ }
export function destroy() { /* limpiar listeners */ }
export function onEnter() { /* al navegar hacia aquí */ }
export function onLeave() { /* al salir */ }
export function pause()   { /* app en segundo plano */ }
export async function resume(container) { /* app regresa */ }
```

3. Crear `module.js` con el descriptor:

```js
import { init, destroy, onEnter, onLeave, pause, resume } from './mi-modulo.js';

export default {
  id:          'mi-modulo',
  label:       'Mi Módulo',
  desc:        'Descripción corta',
  emoji:       '🧩',
  color:       '#6366F1',
  orden:       7,
  habilitado:  true,
  requierePin: false,
  init, destroy, onEnter, onLeave, pause, resume,
  cache: [],
};
```

4. Importar y registrar en `index.html`:

```js
import MiModulo from './modules/mi-modulo/module.js';

const MODULE_REGISTRY = [
  // ... módulos existentes ...
  MiModulo,
].filter(m => m.habilitado).sort((a, b) => a.orden - b.orden);
```

---

## Uso sin servidor

Al ser una PWA estática, basta con servir los archivos desde cualquier servidor HTTP. Para desarrollo local:

```bash
# Con Python
python3 -m http.server 8080

# Con Node.js (npx)
npx serve .
```

Para producción se puede publicar directamente en GitHub Pages apuntando a la rama `main`.

---

## Créditos

- **Pictogramas SAAC:** [ARASAAC](https://arasaac.org) — Autor: Sergio Palao. Licencia CC (BY-NC-SA)
- **Fuente:** Nunito — Google Fonts
- **Desarrollo:** Carlos Chee & Claude (Anthropic)
- **Gráficos e ilustraciones:** Gemini (Google) & ChatGPT (OpenAI)

---

## Licencia

Este proyecto es de uso educativo y terapéutico. Los pictogramas ARASAAC tienen su propia licencia CC BY-NC-SA y no pueden usarse con fines comerciales.
