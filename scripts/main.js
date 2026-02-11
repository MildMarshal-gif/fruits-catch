(() => {
  const FC = (window.FC = window.FC || {});
  const QUALITY_STORAGE_KEY = 'fc_quality_mode';
  const QUALITY_QUERY_KEY = 'quality';
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

  const initialQueryMode = readQueryQualityMode();
  let currentQualityMode = initialQueryMode || readStoredQualityMode() || 'balanced';
  const qualityModeListeners = new Set();

  function applyQualityModeToDom() {
    const root = FC.media?.root || document.documentElement;
    if (!root) return;
    root.dataset.qualityMode = currentQualityMode;
  }

  function notifyQualityMode(nextMode) {
    for (const listener of qualityModeListeners) {
      try { listener(nextMode); } catch {}
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
    }
  };

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
    soundOn: true
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
