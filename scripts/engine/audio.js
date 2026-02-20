(() => {
  const FC = (window.FC = window.FC || {});

  const DEFAULT_TRACKS = {
    normal: {
      src: 'assets/sounds/bgm/normal.mp3',
      loop: true,
      loopStart: 0,
      loopEnd: null,
      volume: 1.0
    },
    fever: {
      src: 'assets/sounds/bgm/fever.mp3',
      loop: true,
      loopStart: 0,
      loopEnd: null,
      volume: 1.0
    },
    lose: {
      src: 'assets/sounds/bgm/lose.mp3',
      loop: false,
      loopStart: 0,
      loopEnd: null,
      volume: 0.8
    }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeMode(mode, logger) {
    if (mode === 'normal' || mode === 'fever') return mode;
    if (logger && typeof logger.warn === 'function') {
      logger.warn('[audio] invalid mode, fallback to normal', { mode });
    }
    return 'normal';
  }

  function decodeAudioDataCompat(audioContext, arrayBuffer) {
    if (!audioContext || !arrayBuffer) {
      return Promise.reject(new Error('decodeAudioDataCompat requires context and data'));
    }
    if (audioContext.decodeAudioData.length <= 1) {
      return audioContext.decodeAudioData(arrayBuffer);
    }
    return new Promise((resolve, reject) => {
      try {
        audioContext.decodeAudioData(arrayBuffer, resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  function createAudioEngine(options = {}) {
    const logger = options.logger || console;
    const defaultCrossfadeMs = clamp(Number(options.defaultCrossfadeMs) || 180, 0, 2000);
    const trackDefs = {
      normal: { ...DEFAULT_TRACKS.normal, ...(options.tracks?.normal || {}) },
      fever: { ...DEFAULT_TRACKS.fever, ...(options.tracks?.fever || {}) },
      lose: { ...DEFAULT_TRACKS.lose, ...(options.tracks?.lose || {}) }
    };
    const contextFactory = options.contextFactory || (() => {
      try {
        return new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return null;
      }
    });

    const trackState = {
      normal: {
        id: 'normal',
        ...trackDefs.normal,
        buffer: null,
        loadFailed: false
      },
      fever: {
        id: 'fever',
        ...trackDefs.fever,
        buffer: null,
        loadFailed: false
      },
      lose: {
        id: 'lose',
        ...trackDefs.lose,
        buffer: null,
        loadFailed: false
      }
    };

    let audioContext = options.audioContext || null;
    let masterGain = null;
    let normalBus = null;
    let feverBus = null;
    let loseBus = null;
    let initialized = false;
    let enabled = true;
    let disposed = false;
    let sessionStarted = false;
    let paused = false;
    let activeMode = 'normal';
    let primePromise = null;
    let sessionToken = 0;
    let loseSource = null;

    const loopSources = {
      normal: null,
      fever: null
    };

    function ensureContextAndNodes() {
      if (disposed) return false;
      if (initialized) return !!audioContext;
      if (!audioContext) {
        audioContext = contextFactory();
      }
      if (!audioContext) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] AudioContext unavailable; fallback to silent mode');
        }
        initialized = true;
        return false;
      }
      try {
        masterGain = audioContext.createGain();
        normalBus = audioContext.createGain();
        feverBus = audioContext.createGain();
        loseBus = audioContext.createGain();

        masterGain.gain.value = clamp(Number(options.masterVolume) || 0.3, 0, 1);
        normalBus.gain.value = 0;
        feverBus.gain.value = 0;
        loseBus.gain.value = clamp(trackState.lose.volume ?? 0.8, 0, 2);

        normalBus.connect(masterGain);
        feverBus.connect(masterGain);
        loseBus.connect(masterGain);
        masterGain.connect(audioContext.destination);
      } catch (error) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] failed to initialize audio graph; fallback to silent mode', error);
        }
        audioContext = null;
      } finally {
        initialized = true;
      }
      return !!audioContext;
    }

    async function resumeContext() {
      if (!audioContext) return;
      if (audioContext.state === 'running') return;
      try {
        await audioContext.resume();
      } catch (error) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] resume failed', error);
        }
      }
    }

    function clearLoseSource() {
      if (!loseSource) return;
      const source = loseSource;
      loseSource = null;
      source.onended = null;
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
    }

    function stopLoopSource(trackId) {
      const source = loopSources[trackId];
      if (!source) return;
      loopSources[trackId] = null;
      source.onended = null;
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
    }

    function stopAllLoops() {
      stopLoopSource('normal');
      stopLoopSource('fever');
    }

    function normalizeLoopBounds(track) {
      const duration = Math.max(0, track.buffer?.duration || 0);
      let loopStart = Number.isFinite(track.loopStart) ? track.loopStart : 0;
      let loopEnd = Number.isFinite(track.loopEnd) ? track.loopEnd : duration;
      loopStart = clamp(loopStart, 0, duration);
      loopEnd = clamp(loopEnd, 0, duration);
      if (loopEnd <= loopStart) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] invalid loop points, applying safe fallback', {
            trackId: track.id,
            loopStart: track.loopStart,
            loopEnd: track.loopEnd,
            duration
          });
        }
        loopStart = 0;
        loopEnd = duration;
      }
      if (loopEnd - loopStart < 0.02) {
        loopEnd = clamp(loopStart + 0.02, 0.02, duration);
        if (loopEnd <= loopStart) {
          loopStart = 0;
          loopEnd = duration;
        }
      }
      track.loopStart = loopStart;
      track.loopEnd = loopEnd;
      return { loopStart, loopEnd };
    }

    function createLoopSource(trackId, startAt, offset = 0) {
      const track = trackState[trackId];
      if (!audioContext || !track || !track.buffer) return null;
      try {
        const source = audioContext.createBufferSource();
        source.buffer = track.buffer;
        source.loop = !!track.loop;
        if (source.loop) {
          const loops = normalizeLoopBounds(track);
          source.loopStart = loops.loopStart;
          source.loopEnd = loops.loopEnd;
        }
        if (trackId === 'normal') source.connect(normalBus);
        if (trackId === 'fever') source.connect(feverBus);
        source.onended = () => {
          if (loopSources[trackId] === source) {
            loopSources[trackId] = null;
          }
        };
        const safeOffset = clamp(offset, 0, Math.max(0, (track.buffer.duration || 0) - 0.01));
        source.start(startAt, safeOffset);
        loopSources[trackId] = source;
        return source;
      } catch (error) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] failed to create loop source', { trackId, error });
        }
        return null;
      }
    }

    function setInstantModeGains(mode) {
      if (!audioContext || !normalBus || !feverBus) return;
      const now = audioContext.currentTime;
      normalBus.gain.cancelScheduledValues(now);
      feverBus.gain.cancelScheduledValues(now);
      if (!enabled) {
        normalBus.gain.setValueAtTime(0, now);
        feverBus.gain.setValueAtTime(0, now);
        return;
      }
      if (mode === 'fever') {
        normalBus.gain.setValueAtTime(0, now);
        feverBus.gain.setValueAtTime(1, now);
        return;
      }
      normalBus.gain.setValueAtTime(1, now);
      feverBus.gain.setValueAtTime(0, now);
    }

    function setModeCrossfade(mode, crossfadeMs) {
      if (!audioContext || !normalBus || !feverBus) return;
      const duration = Math.max(0.02, Number(crossfadeMs || defaultCrossfadeMs) / 1000);
      const now = audioContext.currentTime;
      const normalFrom = clamp(normalBus.gain.value, 0, 1);
      const feverFrom = clamp(feverBus.gain.value, 0, 1);
      const thetaStart = Math.atan2(feverFrom, Math.max(0.0001, normalFrom));
      const thetaEnd = mode === 'fever' ? Math.PI / 2 : 0;
      const steps = 64;
      const normalCurve = new Float32Array(steps);
      const feverCurve = new Float32Array(steps);

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const theta = thetaStart + (thetaEnd - thetaStart) * t;
        normalCurve[i] = Math.cos(theta);
        feverCurve[i] = Math.sin(theta);
      }

      normalBus.gain.cancelScheduledValues(now);
      feverBus.gain.cancelScheduledValues(now);
      normalBus.gain.setValueAtTime(normalFrom, now);
      feverBus.gain.setValueAtTime(feverFrom, now);
      normalBus.gain.setValueCurveAtTime(normalCurve, now, duration);
      feverBus.gain.setValueCurveAtTime(feverCurve, now, duration);
      normalBus.gain.setValueAtTime(mode === 'fever' ? 0 : 1, now + duration);
      feverBus.gain.setValueAtTime(mode === 'fever' ? 1 : 0, now + duration);
    }

    async function loadTrack(trackId) {
      const track = trackState[trackId];
      if (!track || !track.src) return false;
      if (!audioContext) return false;
      try {
        const response = await fetch(track.src);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await decodeAudioDataCompat(audioContext, arrayBuffer.slice(0));
        track.buffer = decoded;
        track.loadFailed = false;
        normalizeLoopBounds(track);
        return true;
      } catch (error) {
        track.buffer = null;
        track.loadFailed = true;
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] failed to load track', { trackId, src: track.src, error });
        }
        return false;
      }
    }

    async function prime() {
      if (disposed) return false;
      if (primePromise) return primePromise;

      primePromise = (async () => {
        if (!ensureContextAndNodes()) return false;
        const ids = ['normal', 'fever', 'lose'];
        await Promise.all(ids.map((trackId) => {
          const track = trackState[trackId];
          if (track.buffer) return Promise.resolve(true);
          return loadTrack(trackId);
        }));
        return true;
      })().catch((error) => {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] prime failed', error);
        }
        return false;
      }).finally(() => {
        primePromise = null;
      });

      return primePromise;
    }

    function playLose() {
      if (!audioContext || !enabled) return;
      const track = trackState.lose;
      if (!track?.buffer) return;
      clearLoseSource();
      try {
        const source = audioContext.createBufferSource();
        source.buffer = track.buffer;
        source.loop = false;
        source.connect(loseBus);
        source.onended = () => {
          if (loseSource === source) loseSource = null;
          try { source.disconnect(); } catch {}
        };
        source.start(audioContext.currentTime);
        loseSource = source;
      } catch (error) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] failed to play lose track', error);
        }
      }
    }

    async function startSession(mode = 'normal') {
      activeMode = normalizeMode(mode, logger);
      sessionStarted = true;
      paused = false;
      const token = ++sessionToken;

      await prime();
      if (disposed || token !== sessionToken) return;
      if (!ensureContextAndNodes()) return;
      await resumeContext();

      clearLoseSource();
      stopAllLoops();
      if (!enabled) {
        setInstantModeGains('normal');
        return;
      }

      const now = audioContext.currentTime;
      const startAt = now + 0.01;
      createLoopSource('normal', startAt, 0);
      createLoopSource('fever', startAt, 0);
      setInstantModeGains(activeMode);
    }

    function setEnabled(on) {
      enabled = !!on;
      if (!ensureContextAndNodes()) return;
      if (!enabled) {
        const now = audioContext.currentTime;
        normalBus.gain.cancelScheduledValues(now);
        feverBus.gain.cancelScheduledValues(now);
        normalBus.gain.setValueAtTime(0, now);
        feverBus.gain.setValueAtTime(0, now);
        stopAllLoops();
        clearLoseSource();
        return;
      }
      if (!sessionStarted || paused) return;
      void resumeContext().then(() => {
        if (disposed || !enabled || !sessionStarted || paused) return;
        if (!loopSources.normal && !loopSources.fever) {
          const now = audioContext.currentTime;
          const startAt = now + 0.01;
          createLoopSource('normal', startAt, 0);
          createLoopSource('fever', startAt, 0);
        }
        setInstantModeGains(activeMode);
      });
    }

    function setMode(mode, crossfadeMs = defaultCrossfadeMs) {
      activeMode = normalizeMode(mode, logger);
      if (!ensureContextAndNodes()) return;
      if (!sessionStarted || paused || !enabled) return;
      if (!loopSources.normal && !loopSources.fever) {
        const now = audioContext.currentTime;
        const startAt = now + 0.01;
        createLoopSource('normal', startAt, 0);
        createLoopSource('fever', startAt, 0);
        setInstantModeGains(activeMode);
        return;
      }
      setModeCrossfade(activeMode, crossfadeMs);
    }

    function pause() {
      if (!sessionStarted) return;
      paused = true;
      if (!ensureContextAndNodes()) return;
      stopAllLoops();
      clearLoseSource();
      const now = audioContext.currentTime;
      normalBus.gain.cancelScheduledValues(now);
      feverBus.gain.cancelScheduledValues(now);
      normalBus.gain.setValueAtTime(0, now);
      feverBus.gain.setValueAtTime(0, now);
    }

    function resume() {
      if (!sessionStarted) return;
      paused = false;
      if (!enabled) return;
      void (async () => {
        const token = ++sessionToken;
        await prime();
        if (disposed || token !== sessionToken || !sessionStarted || paused || !enabled) return;
        await resumeContext();
        if (disposed || token !== sessionToken || !sessionStarted || paused || !enabled) return;
        stopAllLoops();
        const now = audioContext.currentTime;
        const startAt = now + 0.01;
        createLoopSource('normal', startAt, 0);
        createLoopSource('fever', startAt, 0);
        setInstantModeGains(activeMode);
      })();
    }

    function endGame() {
      if (!ensureContextAndNodes()) return;
      const token = ++sessionToken;
      sessionStarted = false;
      paused = false;
      const fadeSec = Math.max(0.02, defaultCrossfadeMs / 1000);
      const now = audioContext.currentTime;
      const normalFrom = clamp(normalBus.gain.value, 0, 1);
      const feverFrom = clamp(feverBus.gain.value, 0, 1);
      normalBus.gain.cancelScheduledValues(now);
      feverBus.gain.cancelScheduledValues(now);
      normalBus.gain.setValueAtTime(normalFrom, now);
      feverBus.gain.setValueAtTime(feverFrom, now);
      normalBus.gain.linearRampToValueAtTime(0, now + fadeSec);
      feverBus.gain.linearRampToValueAtTime(0, now + fadeSec);
      setTimeout(() => {
        stopAllLoops();
      }, Math.ceil((fadeSec + 0.04) * 1000));

      if (!enabled) return;
      void (async () => {
        await prime();
        if (disposed || token !== sessionToken || !enabled) return;
        await resumeContext();
        if (disposed || token !== sessionToken || !enabled) return;
        playLose();
      })();
    }

    function setLoopPoints(trackId, points = {}) {
      const track = trackState[trackId];
      if (!track) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] setLoopPoints ignored; unknown track', { trackId });
        }
        return;
      }
      const duration = Math.max(0, track.buffer?.duration || 0);
      const requestedStart = Number(points.loopStart);
      const requestedEnd = Number(points.loopEnd);

      let nextStart = Number.isFinite(requestedStart) ? requestedStart : track.loopStart;
      let nextEnd = Number.isFinite(requestedEnd) ? requestedEnd : track.loopEnd;
      const clampedStart = clamp(Number(nextStart) || 0, 0, duration);
      const clampedEnd = clamp(Number(nextEnd) || duration, 0, duration);

      let corrected = false;
      nextStart = clampedStart;
      nextEnd = clampedEnd;

      if (nextEnd <= nextStart) {
        corrected = true;
        nextStart = 0;
        nextEnd = duration;
      }
      if (nextEnd - nextStart < 0.02) {
        corrected = true;
        nextEnd = clamp(nextStart + 0.02, 0.02, duration);
        if (nextEnd <= nextStart) {
          nextStart = 0;
          nextEnd = duration;
        }
      }

      if (!Number.isFinite(requestedStart) || !Number.isFinite(requestedEnd) || corrected) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[audio] setLoopPoints corrected values', {
            trackId,
            requested: points,
            applied: { loopStart: nextStart, loopEnd: nextEnd },
            duration
          });
        }
      }

      track.loopStart = nextStart;
      track.loopEnd = nextEnd;

      const source = loopSources[trackId];
      if (source && track.loop) {
        try {
          source.loopStart = nextStart;
          source.loopEnd = nextEnd;
        } catch (error) {
          if (logger && typeof logger.warn === 'function') {
            logger.warn('[audio] failed to apply loop points to active source', {
              trackId,
              error
            });
          }
        }
      }
    }

    function dispose() {
      disposed = true;
      sessionStarted = false;
      paused = false;
      stopAllLoops();
      clearLoseSource();
      if (normalBus) {
        try { normalBus.disconnect(); } catch {}
      }
      if (feverBus) {
        try { feverBus.disconnect(); } catch {}
      }
      if (loseBus) {
        try { loseBus.disconnect(); } catch {}
      }
      if (masterGain) {
        try { masterGain.disconnect(); } catch {}
      }
    }

    return {
      prime,
      setEnabled,
      startSession,
      setMode,
      pause,
      resume,
      endGame,
      setLoopPoints,
      dispose
    };
  }

  FC.createAudioEngine = createAudioEngine;
})();
