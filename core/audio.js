const AudioManager = (() => {
  let _audio   = null;
  let _actx    = null;
  let _analyser= null;
  let _source  = null;
  let _idx     = -1;
  let _canciones = [];
  let _onPlayCb  = null;
  let _onStopCb  = null;

  function _init() {
    if (_audio) return;
    _audio = new Audio();
    _audio.crossOrigin = 'anonymous';
    _audio.addEventListener('ended', () => {
      _notificar();
    });
    _audio.addEventListener('play',  _notificar);
    _audio.addEventListener('pause', _notificar);
    try {
      _actx    = new (window.AudioContext || window.webkitAudioContext)();
      _analyser = _actx.createAnalyser();
      _analyser.fftSize = 512;
      _analyser.smoothingTimeConstant = 0.82;
      _source  = _actx.createMediaElementSource(_audio);
      _source.connect(_analyser);
      _analyser.connect(_actx.destination);
    } catch(e) {
      console.warn('[Audio]', e);
    }
  }

  function _notificar() {
    const playing = _audio && !_audio.paused;
    if (playing && _onPlayCb) _onPlayCb(_idx, _canciones[_idx]);
    if (!playing && _onStopCb) _onStopCb();
    _actualizarBtnGlobal();
  }

  function _actualizarBtnGlobal() {
    const btn = document.getElementById('mus-btn-global');
    if (!btn) return;
    const playing = _audio && !_audio.paused;
    btn.style.display = playing ? 'flex' : 'none';
  }

  function _resumeCtx() {
    if (_actx && _actx.state === 'suspended') _actx.resume();
  }

  return {
    get audio()    { return _audio; },
    get analyser() { return _analyser; },
    get idx()      { return _idx; },
    get canciones(){ return _canciones; },
    get playing()  { return _audio && !_audio.paused; },

    setCanciones(list) { _canciones = list; },

    play(idx, srcUrl) {
      _init();
      _resumeCtx();
      _idx = idx;
      if (_audio.src !== srcUrl) {
        _audio.src = srcUrl;
      } else {
        _audio.currentTime = 0;
      }
      _audio.play().catch(e => console.warn('[Audio] play:', e));
    },

    stop() {
      if (_audio) { _audio.pause(); _audio.currentTime = 0; }
      _notificar();
    },

    onPlay(cb)  { _onPlayCb  = cb; },
    onStop(cb)  { _onStopCb  = cb; },
  };
})();

export default AudioManager;
