(() => {
  const FC = (window.FC = window.FC || {});
  const QUALITY_STORAGE_KEY = 'fc_quality_mode';
  const SOUND_STORAGE_KEY = 'fc_sound_on';
  const BGM_STORAGE_KEY = 'fc_bgm_on';
  const SFX_STORAGE_KEY = 'fc_sfx_on';
  const DEV_AUDIO_CONTROLS_STORAGE_KEY = 'fc_dev_audio_controls';
  const QUALITY_QUERY_KEY = 'quality';
  const DEV_AUDIO_QUERY_KEY = 'devAudio';
  // DEV-only controls default switch. Set false to hide without deleting code.
  const DEFAULT_DEV_AUDIO_CONTROLS_ENABLED = true;
  const QUALITY_MODES = new Set(['auto', 'quality', 'balanced', 'performance']);

  const canvas = document.getElementById('game');
  const ctx = canvas ? canvas.getContext('2d') : null;
  if (ctx && 'imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'high';
  }

  FC.dom = {
    canvas,
    ctx,
    scoreEl: document.getElementById('score'),
    scoreMulEl: document.getElementById('scoreMul'),
    scoreCardEl: document.querySelector('.score-card'),
    heartsEl: document.getElementById('hearts'),
    wrapEl: document.querySelector('.wrap'),
    overlay: document.getElementById('overlay'),
    pausePanel: document.getElementById('pausePanel'),
    startBtn: document.getElementById('startBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    pauseRestartBtn: document.getElementById('pauseRestartBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    soundBtn: document.getElementById('soundBtn'),
    bgmDevBtn: document.getElementById('bgmDevBtn'),
    sfxDevBtn: document.getElementById('sfxDevBtn'),
    devAudioControlsEl: document.getElementById('devAudioControls'),
    feverBadge: document.getElementById('feverBadge'),
    feverTimeEl: document.getElementById('feverTime')
  };

  FC.media = {
    root: document.documentElement,
    reducedMotionQuery: window.matchMedia('(prefers-reduced-motion: reduce)'),
    coarsePointerQuery: window.matchMedia('(pointer:coarse)')
  };

  FC.constants = {
    MAX_MISSES: 3,
    FEVER_DURATION: 10
  };

  function normalizeQualityMode(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return QUALITY_MODES.has(normalized) ? normalized : null;
  }

  function normalizeToggleValue(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
    if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
    return null;
  }

  function readQueryQualityMode() {
    try {
      const url = new URL(window.location.href);
      return normalizeQualityMode(url.searchParams.get(QUALITY_QUERY_KEY));
    } catch {
      return null;
    }
  }

  function readStoredQualityMode() {
    try {
      return normalizeQualityMode(localStorage.getItem(QUALITY_STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function writeStoredQualityMode(mode) {
    try {
      localStorage.setItem(QUALITY_STORAGE_KEY, mode);
    } catch {
      // ignore storage failures
    }
  }

  function readStoredSoundOn() {
    try {
      const raw = localStorage.getItem(SOUND_STORAGE_KEY);
      return normalizeToggleValue(raw);
    } catch {
      return null;
    }
  }

  function writeStoredSoundOn(soundOn) {
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, soundOn ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }

  function readStoredBgmOn() {
    try {
      return normalizeToggleValue(localStorage.getItem(BGM_STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function writeStoredBgmOn(bgmOn) {
    try {
      localStorage.setItem(BGM_STORAGE_KEY, bgmOn ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }

  function readStoredSfxOn() {
    try {
      return normalizeToggleValue(localStorage.getItem(SFX_STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function writeStoredSfxOn(sfxOn) {
    try {
      localStorage.setItem(SFX_STORAGE_KEY, sfxOn ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }

  function readQueryDevAudioControlsEnabled() {
    try {
      const url = new URL(window.location.href);
      return normalizeToggleValue(url.searchParams.get(DEV_AUDIO_QUERY_KEY));
    } catch {
      return null;
    }
  }

  function readStoredDevAudioControlsEnabled() {
    try {
      return normalizeToggleValue(localStorage.getItem(DEV_AUDIO_CONTROLS_STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function writeStoredDevAudioControlsEnabled(enabled) {
    try {
      localStorage.setItem(DEV_AUDIO_CONTROLS_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }

  const initialQueryMode = readQueryQualityMode();
  const queryDevAudioControlsEnabled = readQueryDevAudioControlsEnabled();
  let currentQualityMode = initialQueryMode || readStoredQualityMode() || 'balanced';
  let currentSoundOn = readStoredSoundOn();
  if (currentSoundOn == null) currentSoundOn = true;
  let currentBgmOn = readStoredBgmOn();
  if (currentBgmOn == null) currentBgmOn = true;
  let currentSfxOn = readStoredSfxOn();
  if (currentSfxOn == null) currentSfxOn = true;
  const devAudioControlsEnabled = queryDevAudioControlsEnabled
    ?? readStoredDevAudioControlsEnabled()
    ?? DEFAULT_DEV_AUDIO_CONTROLS_ENABLED;
  if (queryDevAudioControlsEnabled != null) {
    writeStoredDevAudioControlsEnabled(queryDevAudioControlsEnabled);
  }
  const qualityModeListeners = new Set();
  const soundListeners = new Set();

  function applyQualityModeToDom() {
    const root = FC.media?.root || document.documentElement;
    if (!root) return;
    root.dataset.qualityMode = currentQualityMode;
    root.dataset.devAudioControls = devAudioControlsEnabled ? '1' : '0';
  }

  function notifyQualityMode(nextMode) {
    for (const listener of qualityModeListeners) {
      try { listener(nextMode); } catch {}
    }
  }

  function notifySoundOn(nextSoundOn) {
    for (const listener of soundListeners) {
      try { listener(nextSoundOn); } catch {}
    }
  }

  FC.settings = {
    getQuality() {
      return currentQualityMode;
    },
    setQuality(nextMode, options = {}) {
      const normalized = normalizeQualityMode(nextMode);
      if (!normalized) return currentQualityMode;
      currentQualityMode = normalized;
      applyQualityModeToDom();
      if (options.persist !== false) {
        writeStoredQualityMode(normalized);
      }
      notifyQualityMode(normalized);
      return currentQualityMode;
    },
    subscribeQuality(listener) {
      if (typeof listener !== 'function') return () => {};
      qualityModeListeners.add(listener);
      return () => qualityModeListeners.delete(listener);
    },
    getSoundOn() {
      return currentSoundOn;
    },
    setSoundOn(nextSoundOn, options = {}) {
      currentSoundOn = !!nextSoundOn;
      if (options.persist !== false) {
        writeStoredSoundOn(currentSoundOn);
      }
      notifySoundOn(currentSoundOn);
      return currentSoundOn;
    },
    subscribeSound(listener) {
      if (typeof listener !== 'function') return () => {};
      soundListeners.add(listener);
      return () => soundListeners.delete(listener);
    },
    getBgmOn() {
      return currentBgmOn;
    },
    setBgmOn(nextBgmOn, options = {}) {
      currentBgmOn = !!nextBgmOn;
      if (options.persist !== false) {
        writeStoredBgmOn(currentBgmOn);
      }
      return currentBgmOn;
    },
    getSfxOn() {
      return currentSfxOn;
    },
    setSfxOn(nextSfxOn, options = {}) {
      currentSfxOn = !!nextSfxOn;
      if (options.persist !== false) {
        writeStoredSfxOn(currentSfxOn);
      }
      return currentSfxOn;
    }
  };

  FC.debug = FC.debug || {};
  FC.debug.devAudioControlsEnabled = devAudioControlsEnabled;

  FC.perf = FC.perf || {
    getSnapshot() {
      return {
        fpsAvg: 0,
        fpsP1: 0,
        frameP95Ms: 0,
        inputLatencyP95Ms: 0,
        dprScale: 1,
        qualityTier: 'quality'
      };
    }
  };

  FC.attachPerfEngine = (perfEngine) => {
    if (!perfEngine || typeof perfEngine.getSnapshot !== 'function') return;
    FC.perf = {
      getSnapshot: () => perfEngine.getSnapshot()
    };
  };

  FC.state = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    misses: 0,
    fever: false,
    feverEnd: 0,
    soundOn: currentSoundOn,
    bgmOn: currentBgmOn,
    sfxOn: currentSfxOn
  };

  applyQualityModeToDom();
  if (initialQueryMode) {
    FC.settings.setQuality(initialQueryMode, { persist: false });
  }

  FC._bootstrapped = false;
  FC.bootstrap = () => {
    if (FC._bootstrapped) return;
    FC._bootstrapped = true;
    if (typeof FC.initGame === 'function') {
      FC.initGame();
    }
  };
})();
