(() => {
      const FC = window.FC;
      FC.initGame = () => {
      const ui = FC.ui;
      const sharedState = FC.state;
      const {
        canvas,
        ctx,
        scoreEl,
        scoreMulEl,
        scoreCardEl,
        heartsEl,
        wrapEl,
        overlay,
        pausePanel,
        startBtn,
        resumeBtn,
        pauseRestartBtn,
        pauseBtn,
        soundBtn,
        feverBadge,
        feverTimeEl
      } = FC.dom;
      const { root, reducedMotionQuery, coarsePointerQuery } = FC.media;


      const DEVICE_PRESETS = {
        mobile: {
          uiScale: 0.86,
          hudScale: 0.83,
          titleScale: 0.84,
          fxDensity: 0.56,
          fruitScale: 1.05,
          basketScale: 0.61,
          pauseScale: 0.78,
          tapTarget: 44
        },
        tablet: {
          uiScale: 0.95,
          hudScale: 0.91,
          titleScale: 0.93,
          fxDensity: 0.78,
          fruitScale: 1.02,
          basketScale: 0.96,
          pauseScale: 0.90,
          tapTarget: 42
        },
        desktop: {
          uiScale: 1.0,
          hudScale: 1.0,
          titleScale: 1.0,
          fxDensity: 1.0,
          fruitScale: 1.0,
          basketScale: 1.0,
          pauseScale: 1.0,
          tapTarget: 40
        }
      };

      const BASE_BASKET_W = 240;
      const BASE_BASKET_H = 62;
      const BASE_CANVAS_W = 1280;
      const BASE_CANVAS_H = 720;
      const BASE_FRUIT_RADIUS_MIN = 28;
      const BASE_FRUIT_RADIUS_MAX = 42;
      let fruitRadiusMin = BASE_FRUIT_RADIUS_MIN;
      let fruitRadiusMax = BASE_FRUIT_RADIUS_MAX;
      let fxDensity = 1;
      let particleDensity = 1;
      let backgroundMotionScale = 1;
      let rotationMotionScale = 1;
      let floatTextScale = 1;
      let drawFixScaleY = 1;
      let canvasBodyFontFamily = '"FCRoundedXMplus1p", sans-serif';
      let canvasBodyFontWeight = '500';

      function syncCanvasBodyFontTokens() {
        const targetRoot = root || document.documentElement;
        if (!targetRoot || typeof getComputedStyle !== 'function') return;
        const styles = getComputedStyle(targetRoot);
        const familyFromCanvas = styles.getPropertyValue('--font-family-body-canvas').trim();
        const familyFromBody = styles.getPropertyValue('--font-family-body').trim();
        const weightFromBody = styles.getPropertyValue('--font-weight-body').trim();
        canvasBodyFontFamily = familyFromCanvas || familyFromBody || '"FCRoundedXMplus1p", sans-serif';
        canvasBodyFontWeight = weightFromBody || '500';
      }

      // Game constants
      const MAX_MISSES = FC.constants.MAX_MISSES;

      // Basket (kid-friendly big)
      const basket = {
        w: BASE_BASKET_W,
        h: BASE_BASKET_H,
        x: BASE_CANVAS_W / 2,
        y: BASE_CANVAS_H - 90,
        vx: 0,
        speed: 1150, // px/s
        targetX: null
      };

      // Fruits (fixed size per species; faster falls are smaller)
      const FRUITS = [
        { kind:'banana',     mul:0.80, points: 8, color:'#ffd670' },
        { kind:'apple',      mul:0.88, points: 9, color:'#ff6b7d' },
        { kind:'orange',     mul:0.96, points:10, color:'#ffb24f' },
        { kind:'peach',      mul:1.04, points:10, color:'#ff9b82' },
        { kind:'strawberry', mul:1.12, points:11, color:'#ff5f92' },
        { kind:'grape',      mul:1.22, points:12, color:'#8f7cff' },
        { kind:'watermelon', mul:1.30, points:13, color:'#47ce8f' },
      ];

      const FRUIT_MUL_MIN = Math.min(...FRUITS.map((f) => f.mul));
      const FRUIT_MUL_MAX = Math.max(...FRUITS.map((f) => f.mul));
      const GRAPE_FRUIT = FRUITS.find((f) => f.kind === 'grape');

      // Special star
      const STAR = { kind:'star', color:'#ffd670' };
      const STAR_CHANCE_NORMAL = 0.05;
      const STAR_CHANCE_FEVER = 0.05;
      const HAZARD = { kind:'bug', color:'#7b3f2f' };
      const HAZARD_CHANCE_NORMAL = 0.12;
      const HAZARD_CHANCE_FEVER = 0.08;

      // Spawn rate & base fall speed (global progression will multiply)
      function spawnInterval() {
        // start ~0.85s -> later ~0.55s
        const t = Math.min(1, totalElapsed / 120);
        return 0.85 - t * 0.30;
      }
      function baseFallSpeed() {
        return 310; // base speed before multipliers
      }

      function getFruitRadiusForMul(mul) {
        const range = Math.max(0.0001, FRUIT_MUL_MAX - FRUIT_MUL_MIN);
        const t = clamp((mul - FRUIT_MUL_MIN) / range, 0, 1);
        return fruitRadiusMax - (fruitRadiusMax - fruitRadiusMin) * t;
      }

      // State
      let running = false;
      let paused = false;
      let gameOver = false;
      let score = 0;
      let misses = 0;

      // elapsed time for progression
      let totalElapsed = 0; // seconds

      // Fever
      let fever = false;
      let feverEnd = 0; // seconds (game time)
      const FEVER_DURATION = FC.constants.FEVER_DURATION;
      const FEVER_ENTER_DURATION = 0.82;
      const FEVER_EXIT_DURATION = 0.56;

      const feverFx = {
        phase: 'idle', // idle | enter | active | exit
        phaseStart: 0,
        enterDuration: FEVER_ENTER_DURATION,
        exitDuration: FEVER_EXIT_DURATION,
        flash: 0,
        hitPulse: 0,
        originX: BASE_CANVAS_W * 0.5,
        originY: BASE_CANVAS_H * 0.35
      };
      let scorePulse = 0;
      let runtimeFxQuality = 1;

      const FEATURE_FLAGS = {
        USE_IMAGE_SPRITES: true,
        USE_IMAGE_BASKET: true,
        USE_IMAGE_FX: true
      };

      const ASSET_PRELOAD_TIMEOUT_MS = 1800;
      const ASSET_RETRY_MAX = 1;
      const ASSET_START_REQUIRED_RATIO = 0.0;

      const IMAGE_MANIFEST = {
        fruit_apple: 'assets/images/game-objects/fruit_apple_v2.png',
        fruit_banana: 'assets/images/game-objects/fruit_banana_v2.png',
        fruit_orange: 'assets/images/game-objects/fruit_orange_v2.png',
        fruit_peach: 'assets/images/game-objects/fruit_peach_v2.png',
        fruit_strawberry: 'assets/images/game-objects/fruit_strawberry_v2.png',
        fruit_grape: 'assets/images/game-objects/fruit_grape_v2.png',
        fruit_watermelon: 'assets/images/game-objects/fruit_watermelon_v2.png',
        hazard_bug: 'assets/images/game-objects/hazard_bug_v2.png',
        bonus_star: 'assets/images/game-objects/bonus_star_v2.png',
        basket_default: 'assets/images/game-objects/basket_default_v1.png',
        fx_bug_hit: 'assets/images/game-effects/fx_bug_hit_v1.png',
        fx_star_burst: 'assets/images/game-effects/fx_star_burst_v1.png',
        fx_fruit_pop: 'assets/images/game-effects/fx_fruit_pop_v1.png'
      };

      const imageCache = new Map();
      // key -> { state, img, w, h, error, retryCount, lastTriedAt, promise }

      const spriteMeta = {
        fruit_apple: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        fruit_banana: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        fruit_orange: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        fruit_peach: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        fruit_strawberry: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        fruit_grape: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        fruit_watermelon: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        hazard_bug: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        bonus_star: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        basket_default: { anchorX: 0.5, anchorY: 0.5, drawScale: 1.00, bodyWidthPx: 740, bodyHeightPx: 190 },
        fx_bug_hit: { collisionRadiusPx: 128, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        fx_star_burst: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 },
        fx_fruit_pop: { collisionRadiusPx: 512, anchorX: 0.5, anchorY: 0.5, drawScale: 1.00 }
      };

      const SPRITE_RASTER_CACHE_MAX = 64;
      const FX_FRUIT_POP_TINT_ALPHA_CUTOFF = 6;
      const spriteRasterCache = new Map();
      // `${spriteKey}:${sizeBucket}:${dpr}` -> { canvas, drawW, drawH }
      const fruitPopTintSourceCache = new Map();
      // `#rrggbb` -> tinted canvas source for fx_fruit_pop

      const impactFxQueue = [];
      // { fxKey, x, y, r, rot, life, t, alpha, scale, tintColor }

      const assetLoadMetrics = {
        total: Object.keys(IMAGE_MANIFEST).length,
        ready: 0,
        error: 0,
        timeout: false,
        preloadElapsedMs: 0
      };

      const FX_MAX_ACTIVE_DESKTOP = 36;
      const FX_MAX_ACTIVE_TABLET = 24;
      const FX_MAX_ACTIVE_MOBILE = 16;

      const playMetrics = {
        elapsedSec: 0,
        frames: 0,
        feverTriggers: 0,
        baselineLogged: false
      };

      // Entities
      const objects = []; // fruits & star
      const pops = [];
      const floatTexts = [];
      const feverShockwaves = [];
      const feverSparks = [];
      const feverHitBursts = [];
      const feverStreams = [];
      const shootingStars = [];

      let damageFlash = 0;
      let lifeFxTimeout = null;
      let shootingStarSpawnTimer = 0;

      // Input
      const keys = new Set();
      window.addEventListener('keydown', (e) => {
        if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
        keys.add(e.key);
        if (e.key === ' ' && running && !gameOver) togglePause();
      });
      window.addEventListener('keyup', (e) => keys.delete(e.key));

      function setBasketByClientX(clientX) {
        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width * canvas.width;
        basket.targetX = clamp(x, basket.w/2 + 14, canvas.width - basket.w/2 - 14);
      }
      canvas.addEventListener('mousemove', (e) => setBasketByClientX(e.clientX));
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches?.[0]) setBasketByClientX(e.touches[0].clientX);
      }, {passive:true});
      canvas.addEventListener('touchmove', (e) => {
        if (e.touches?.[0]) setBasketByClientX(e.touches[0].clientX);
      }, {passive:true});

      // Audio (WebAudio synth BGM: normal & fever)
      const audioCtx = (() => {
        try { return new (window.AudioContext || window.webkitAudioContext)(); }
        catch { return null; }
      })();
      let soundOn = true;

      ui.wireControls({
        startBtn,
        pauseBtn,
        resumeBtn,
        pauseRestartBtn,
        soundBtn,
        onStart: () => startGame(),
        onPause: () => setPaused(true),
        onResume: () => setPaused(false),
        onRestart: () => restartGame(),
        isSoundOn: () => soundOn,
        onToggleSound: async (nextSoundOn) => {
          soundOn = nextSoundOn;
          if (audioCtx && soundOn) {
            try { await audioCtx.resume(); } catch {}
          }
          setMusicEnabled(soundOn);
        }
      });

      function oneShotVoice({
        time,
        freq,
        duration,
        destination,
        type = 'triangle',
        gainPeak = 0.16,
        detune = 0,
        slideTo = null
      }) {
        if (!freq || !duration) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.detune.setValueAtTime(detune, time);
        osc.frequency.setValueAtTime(freq, time);
        if (slideTo && slideTo > 0) {
          osc.frequency.exponentialRampToValueAtTime(slideTo, time + duration * 0.88);
        }

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(gainPeak, time + duration * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + duration + 0.02);
      }

      // SFX
      function sfx(type='catch') {
        if (!audioCtx || !soundOn) return;
        const t0 = audioCtx.currentTime + 0.004;
        const out = audioCtx.createGain();
        out.gain.value = 0.24;
        out.connect(audioCtx.destination);

        const preset = type === 'miss'
          ? { notes:[280, 220, 160], step:0.034, dur:0.11, wave:'triangle', harmWave:'sine', harmMul:0.50, sparkle:false }
          : type === 'star'
            ? { notes:[740, 988, 1320, 1760], step:0.026, dur:0.13, wave:'triangle', harmWave:'square', harmMul:2.0, sparkle:true }
            : { notes:[560, 760, 960], step:0.024, dur:0.10, wave:'triangle', harmWave:'square', harmMul:1.5, sparkle:true };

        for (let i=0; i<preset.notes.length; i++) {
          const base = preset.notes[i];
          const t = t0 + i * preset.step;
          oneShotVoice({
            time:t,
            freq:base,
            duration:preset.dur,
            destination:out,
            type:preset.wave,
            gainPeak:type === 'miss' ? 0.11 : 0.14
          });
          oneShotVoice({
            time:t + 0.003,
            freq:base * preset.harmMul,
            duration:preset.dur * 0.68,
            destination:out,
            type:preset.harmWave,
            gainPeak:type === 'star' ? 0.09 : 0.06,
            detune:6
          });
        }

        if (preset.sparkle) {
          oneShotVoice({
            time:t0 + preset.step * 0.5,
            freq:type === 'star' ? 2480 : 2120,
            duration:type === 'star' ? 0.14 : 0.09,
            destination:out,
            type:'square',
            gainPeak:type === 'star' ? 0.075 : 0.05
          });
        }
      }

      // BGM sequencer
      const music = (() => {
        if (!audioCtx) return null;

        const master = audioCtx.createGain();
        master.gain.value = 0.2;
        master.connect(audioCtx.destination);

        const normalGain = audioCtx.createGain();
        const feverGain = audioCtx.createGain();
        normalGain.gain.value = 0.0;
        feverGain.gain.value = 0.0;
        normalGain.connect(master);
        feverGain.connect(master);

        let enabled = true;
        let mode = 'normal';
        let step = 0;
        let timer = null;
        let nextNoteTime = 0;

        const lookAhead = 0.13;
        const interval = 22;
        const bpmNormal = 124;
        const bpmFever = 152;

        const N = {
          C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
          C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
          C6:1046.5
        };

        const normalLead = [
          N.E5,N.G5,N.B5,N.G5, N.D5,N.F5,N.A5,N.F5,
          N.C5,N.E5,N.G5,N.E5, N.D5,N.F5,N.A5,N.G5
        ];
        const normalBass = [
          N.C4,0,N.C4,0, N.F4,0,N.F4,0,
          N.A4,0,N.A4,0, N.G4,0,N.G4,0
        ];
        const normalChime = [
          N.E6,0,0,N.B5, 0,N.A5,0,0,
          N.G5,0,0,N.E5, 0,N.D5,0,0
        ];

        const feverLead = [
          N.A5,N.C6,N.B5,N.G5, N.E5,N.G5,N.A5,N.B5,
          N.C6,N.B5,N.G5,N.E5, N.G5,N.A5,N.C6,N.B5
        ];
        const feverBass = [
          N.A4,0,N.A4,0, N.G4,0,N.G4,0,
          N.E4,0,N.E4,0, N.F4,0,N.F4,0
        ];
        const feverChime = [
          N.C6,0,N.B5,0, N.A5,0,N.G5,0,
          N.E5,0,N.G5,0, N.A5,0,N.B5,0
        ];

        function playPatternNote(time, freq, duration, gainNode, options = {}) {
          if (!freq) return;
          oneShotVoice({
            time,
            freq,
            duration,
            destination:gainNode,
            type:options.type || 'triangle',
            gainPeak:options.gainPeak ?? 0.12,
            detune:options.detune ?? 0,
            slideTo:options.slideTo ?? null
          });
        }

        function scheduler() {
          if (!enabled) return;
          const now = audioCtx.currentTime;

          while (nextNoteTime < now + lookAhead) {
            const isFever = mode === 'fever';
            const bpm = isFever ? bpmFever : bpmNormal;
            const stepDur = (60 / bpm) / 4;
            const lane = isFever ? feverGain : normalGain;
            const lead = isFever ? feverLead : normalLead;
            const bass = isFever ? feverBass : normalBass;
            const chime = isFever ? feverChime : normalChime;
            const idx = step % 16;

            playPatternNote(nextNoteTime, lead[idx], stepDur * 0.92, lane, {
              type:isFever ? 'sawtooth' : 'triangle',
              gainPeak:isFever ? 0.12 : 0.10,
              slideTo:isFever ? lead[idx] * 1.02 : null
            });

            playPatternNote(nextNoteTime, bass[idx], stepDur * 0.98, lane, {
              type:'sine',
              gainPeak:isFever ? 0.10 : 0.085,
              detune:-3
            });

            if ((step % 2) === 0) {
              playPatternNote(nextNoteTime + 0.004, chime[idx], stepDur * 0.55, lane, {
                type:'square',
                gainPeak:isFever ? 0.052 : 0.04,
                detune:8
              });
            }

            if ((step % 4) === 0) {
              playPatternNote(nextNoteTime, isFever ? 146 : 128, stepDur * 0.42, lane, {
                type:'sine',
                gainPeak:isFever ? 0.072 : 0.05
              });
            }

            nextNoteTime += stepDur;
            step++;
          }
        }

        function start() {
          if (timer) return;
          nextNoteTime = audioCtx.currentTime + 0.06;
          timer = setInterval(scheduler, interval);
        }

        function stop() {
          if (!timer) return;
          clearInterval(timer);
          timer = null;
          normalGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.03);
          feverGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.03);
        }

        function setEnabled(v) {
          enabled = v;
          if (!enabled) {
            stop();
            return;
          }
          start();
          setMode(mode);
        }

        function setMode(newMode) {
          mode = newMode;
          const t = audioCtx.currentTime;
          if (mode === 'fever') {
            normalGain.gain.setTargetAtTime(0.0, t, 0.05);
            feverGain.gain.setTargetAtTime(1.0, t, 0.05);
          } else {
            feverGain.gain.setTargetAtTime(0.0, t, 0.05);
            normalGain.gain.setTargetAtTime(1.0, t, 0.05);
          }
        }

        return { start, stop, setEnabled, setMode };
      })();

      function setMusicEnabled(on) {
        if (!music) return;
        if (!on) music.setEnabled(false);
        else {
          music.setEnabled(true);
          music.setMode(fever ? 'fever' : 'normal');
        }
      }

      function syncSharedState() {
        sharedState.running = running;
        sharedState.paused = paused;
        sharedState.gameOver = gameOver;
        sharedState.score = score;
        sharedState.misses = misses;
        sharedState.fever = fever;
        sharedState.feverEnd = feverEnd;
        sharedState.soundOn = soundOn;
      }

      // Helpers
      function rand(a,b){ return a + Math.random()*(b-a); }
      function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
      function easeOutCubic(t){ const p = clamp(t, 0, 1); return 1 - Math.pow(1 - p, 3); }
      function easeInCubic(t){ const p = clamp(t, 0, 1); return p * p * p; }
      function getRuntimeFxDensity() {
        return clamp(particleDensity * runtimeFxQuality, 0.12, 1.12);
      }

      let assetLoadPromise = null;
      let gameStartTicket = 0;

      function resetPlayMetrics() {
        playMetrics.elapsedSec = 0;
        playMetrics.frames = 0;
        playMetrics.feverTriggers = 0;
        playMetrics.baselineLogged = false;
      }

      function updateBaselineMetrics(dt) {
        if (!running || paused || gameOver) return;
        playMetrics.elapsedSec += dt;
        playMetrics.frames += 1;
        if (!playMetrics.baselineLogged && playMetrics.elapsedSec >= 60) {
          playMetrics.baselineLogged = true;
          const avgFps = playMetrics.frames / Math.max(playMetrics.elapsedSec, 0.0001);
          console.info('[baseline-60s]', {
            score,
            misses,
            feverTriggers: playMetrics.feverTriggers,
            avgFps: Number(avgFps.toFixed(2))
          });
        }
      }

      function refreshAssetLoadMetrics() {
        const entries = [...imageCache.values()];
        assetLoadMetrics.total = Object.keys(IMAGE_MANIFEST).length;
        assetLoadMetrics.ready = entries.filter((entry) => entry.state === 'ready').length;
        assetLoadMetrics.error = entries.filter((entry) => entry.state === 'error' && entry.retryCount > ASSET_RETRY_MAX).length;
      }

      function getAssetReadyRatio() {
        if (!assetLoadMetrics.total) return 1;
        return assetLoadMetrics.ready / assetLoadMetrics.total;
      }

      function ensureImageEntry(key) {
        let entry = imageCache.get(key);
        if (!entry) {
          entry = {
            state: 'idle',
            img: null,
            w: 0,
            h: 0,
            error: null,
            retryCount: 0,
            lastTriedAt: 0,
            promise: null
          };
          imageCache.set(key, entry);
        }
        return entry;
      }

      function loadImageAsset(key) {
        const src = IMAGE_MANIFEST[key];
        if (!src) return Promise.resolve(null);

        const entry = ensureImageEntry(key);
        if (entry.state === 'ready' && entry.img) return Promise.resolve(entry);
        if (entry.state === 'loading' && entry.promise) return entry.promise;
        if (entry.state === 'error' && entry.retryCount > ASSET_RETRY_MAX) return Promise.resolve(entry);

        entry.state = 'loading';
        entry.error = null;
        entry.lastTriedAt = performance.now();

        entry.promise = new Promise((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            entry.state = 'ready';
            entry.img = img;
            entry.w = img.naturalWidth || img.width || 0;
            entry.h = img.naturalHeight || img.height || 0;
            entry.error = null;
            entry.promise = null;
            refreshAssetLoadMetrics();
            resolve(entry);
          };
          img.onerror = (err) => {
            entry.state = 'error';
            entry.retryCount += 1;
            entry.error = err;
            entry.promise = null;
            refreshAssetLoadMetrics();
            resolve(entry);
          };
          img.src = src;
        });

        return entry.promise;
      }

      async function loadImageAssetWithRetry(key) {
        let entry = null;
        for (let attempt = 0; attempt <= ASSET_RETRY_MAX; attempt++) {
          entry = await loadImageAsset(key);
          if (entry?.state === 'ready') return entry;
          if (entry?.state === 'error' && entry.retryCount > ASSET_RETRY_MAX) break;
        }
        return entry;
      }

      async function loadGameAssets() {
        if (assetLoadPromise) return assetLoadPromise;
        const startedAt = performance.now();
        refreshAssetLoadMetrics();
        assetLoadPromise = Promise.allSettled(
          Object.keys(IMAGE_MANIFEST).map((key) => loadImageAssetWithRetry(key))
        ).then((results) => {
          primeFruitPopTintSources();
          refreshAssetLoadMetrics();
          assetLoadMetrics.preloadElapsedMs = performance.now() - startedAt;
          return results;
        }).catch((err) => {
          console.warn('asset preload failed', err);
          refreshAssetLoadMetrics();
          return [];
        });
        return assetLoadPromise;
      }

      function getImageOrNull(key) {
        const entry = imageCache.get(key);
        if (!entry || entry.state !== 'ready' || !entry.img) return null;
        return entry.img;
      }

      async function warmupAssetsWithTimeout() {
        const startedAt = performance.now();
        assetLoadMetrics.timeout = false;
        const task = loadGameAssets();
        const timeout = new Promise((resolve) => {
          setTimeout(() => resolve('timeout'), ASSET_PRELOAD_TIMEOUT_MS);
        });
        const result = await Promise.race([task.then(() => 'loaded'), timeout]);
        assetLoadMetrics.timeout = result === 'timeout';
        assetLoadMetrics.preloadElapsedMs = performance.now() - startedAt;
      }

      function getSpriteKeyForObject(o) {
        if (o.kind === 'star') return 'bonus_star';
        if (o.kind === 'bug') return 'hazard_bug';
        if (o.kind === 'fruit') return `fruit_${o.fruitKind}`;
        return null;
      }

      function getFxKeyForObject(o) {
        if (o.kind === 'star') return 'fx_star_burst';
        if (o.kind === 'bug') return 'fx_bug_hit';
        return 'fx_fruit_pop';
      }

      function getFxQueueLimit() {
        const device = root.dataset.device || detectDeviceType();
        if (device === 'mobile') return FX_MAX_ACTIVE_MOBILE;
        if (device === 'tablet') return FX_MAX_ACTIVE_TABLET;
        return FX_MAX_ACTIVE_DESKTOP;
      }

      function normalizeHexColor(color) {
        if (typeof color !== 'string') return null;
        const trimmed = color.trim().toLowerCase();
        const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
        if (!match) return null;
        const body = match[1].toLowerCase();
        if (body.length === 3) {
          return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
        }
        return `#${body}`;
      }

      function parseHexColor(color) {
        const key = normalizeHexColor(color);
        if (!key) return null;
        return {
          key,
          r: Number.parseInt(key.slice(1, 3), 16),
          g: Number.parseInt(key.slice(3, 5), 16),
          b: Number.parseInt(key.slice(5, 7), 16)
        };
      }

      function getFruitPopTintColor(fruitKind) {
        return fruitKind === 'watermelon' ? '#ff1a1a' : getFruitStyle(fruitKind).base;
      }

      function getFruitPopTintSource(baseImg, tintColor) {
        if (!baseImg || !tintColor) return null;
        const tint = parseHexColor(tintColor);
        if (!tint) return null;
        const cached = fruitPopTintSourceCache.get(tint.key);
        if (cached) return cached;

        const srcW = Math.max(1, baseImg.naturalWidth || baseImg.width || 0);
        const srcH = Math.max(1, baseImg.naturalHeight || baseImg.height || 0);
        const offscreen = document.createElement('canvas');
        offscreen.width = srcW;
        offscreen.height = srcH;
        const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
        if (!offCtx) return null;
        offCtx.imageSmoothingEnabled = true;
        offCtx.drawImage(baseImg, 0, 0, srcW, srcH);

        try {
          const imageData = offCtx.getImageData(0, 0, srcW, srcH);
          const pixels = imageData.data;
          for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3];
            if (alpha <= FX_FRUIT_POP_TINT_ALPHA_CUTOFF) {
              pixels[i] = 0;
              pixels[i + 1] = 0;
              pixels[i + 2] = 0;
              pixels[i + 3] = 0;
              continue;
            }
            const luminance = (pixels[i] * 77 + pixels[i + 1] * 150 + pixels[i + 2] * 29) >> 8;
            pixels[i] = Math.round((tint.r * luminance) / 255);
            pixels[i + 1] = Math.round((tint.g * luminance) / 255);
            pixels[i + 2] = Math.round((tint.b * luminance) / 255);
          }
          offCtx.putImageData(imageData, 0, 0);
        } catch {
          // Fallback when pixel readback is unavailable.
          offCtx.globalCompositeOperation = 'source-in';
          offCtx.fillStyle = tint.key;
          offCtx.fillRect(0, 0, srcW, srcH);
          offCtx.globalCompositeOperation = 'source-over';
        }

        fruitPopTintSourceCache.set(tint.key, offscreen);
        return offscreen;
      }

      function primeFruitPopTintSources() {
        const fruitPopImg = getImageOrNull('fx_fruit_pop');
        if (!fruitPopImg) return;
        for (const fruit of FRUITS) {
          getFruitPopTintSource(fruitPopImg, getFruitPopTintColor(fruit.kind));
        }
      }

      function getSpriteRaster(spriteKey, img, targetDrawW, targetDrawH) {
        if (!img || !targetDrawW || !targetDrawH) return null;
        const dpr = Math.max(1, Math.round((window.devicePixelRatio || 1) * 100) / 100);
        const sizeBucket = Math.max(8, Math.round(Math.max(targetDrawW, targetDrawH) / 8) * 8);
        const cacheKey = `${spriteKey}:${sizeBucket}:${dpr}`;
        const cached = spriteRasterCache.get(cacheKey);
        if (cached) {
          spriteRasterCache.delete(cacheKey);
          spriteRasterCache.set(cacheKey, cached);
          return cached;
        }

        const maxNatural = Math.max(1, img.naturalWidth || img.width, img.naturalHeight || img.height);
        const scale = sizeBucket / maxNatural;
        const drawW = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        const drawH = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        const rasterW = Math.max(1, Math.round(drawW * dpr));
        const rasterH = Math.max(1, Math.round(drawH * dpr));

        const offscreen = document.createElement('canvas');
        offscreen.width = rasterW;
        offscreen.height = rasterH;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return null;
        offCtx.imageSmoothingEnabled = true;
        offCtx.drawImage(img, 0, 0, rasterW, rasterH);

        const entry = {
          canvas: offscreen,
          drawW: rasterW / dpr,
          drawH: rasterH / dpr
        };
        spriteRasterCache.set(cacheKey, entry);
        while (spriteRasterCache.size > SPRITE_RASTER_CACHE_MAX) {
          const oldestKey = spriteRasterCache.keys().next().value;
          if (oldestKey == null) break;
          spriteRasterCache.delete(oldestKey);
        }
        return entry;
      }

      function updateScoreCardState() {
        ui.updateScoreCardState({
          scoreCardEl,
          scoreMulEl,
          fever,
          feverPhase: feverFx.phase
        });
      }

      function updatePausePanel() {
        ui.updatePausePanel({
          pausePanel,
          running,
          paused,
          gameOver
        });
      }

      function getLivesLeft() {
        return Math.max(0, MAX_MISSES - misses);
      }

      function applyLifeStateClasses() {
        ui.applyLifeStateClasses({
          wrapEl,
          heartsEl,
          maxMisses: MAX_MISSES,
          misses
        });
      }

      function triggerLifeDamageEffect() {
        const nextFx = ui.triggerLifeDamageEffect({
          wrapEl,
          heartsEl,
          maxMisses: MAX_MISSES,
          misses,
          damageFlash,
          lifeFxTimeout,
          clamp,
          onLifeFxTimeoutClear: () => {
            lifeFxTimeout = null;
          }
        });
        damageFlash = nextFx.damageFlash;
        lifeFxTimeout = nextFx.lifeFxTimeout;
      }

      function updateScorePulseStyles() {
        ui.updateScorePulseStyles({
          scoreEl,
          scoreMulEl,
          fever,
          feverPhase: feverFx.phase,
          scorePulse,
          reducedMotion: reducedMotionQuery.matches,
          onUpdateScoreCardState: updateScoreCardState
        });
      }

      function clearFeverVisualState() {
        feverShockwaves.length = 0;
        feverSparks.length = 0;
        feverHitBursts.length = 0;
        shootingStars.length = 0;
        feverFx.phase = 'idle';
        feverFx.phaseStart = 0;
        feverFx.flash = 0;
        feverFx.hitPulse = 0;
        scorePulse = 0;
        updateScorePulseStyles();
        updateScoreCardState();
        feverBadge.dataset.phase = 'idle';
        feverBadge.classList.remove('fever-neon');
      }

      function rebuildFeverStreams() {
        feverStreams.length = 0;
        const density = getRuntimeFxDensity();
        const count = Math.max(6, Math.round((reducedMotionQuery.matches ? 8 : 16) * density));
        for (let i=0; i<count; i++) {
          feverStreams.push({
            lane: rand(0.15, 0.80),
            seed: Math.random() * 1000,
            speed: rand(0.58, 1.72),
            len: rand(64, 172),
            width: rand(1.2, 3.4),
            amp: rand(6, 20),
            tone: i % 3
          });
        }
      }

      function spawnFeverShockwave(x, y, type='entry') {
        if (type === 'entry') {
          const waveCount = Math.max(1, Math.round((reducedMotionQuery.matches ? 1 : 2) * getRuntimeFxDensity()));
          for (let i=0; i<waveCount; i++) {
            feverShockwaves.push({
              x, y,
              t: -i * 0.08,
              life: feverFx.enterDuration + 0.24 + i * 0.08,
              startR: 16 + i * 10,
              endR: Math.max(canvas.width, canvas.height) * (0.50 + i * 0.12),
              width: 18 - i * 5,
              color: i === 0 ? '255,255,255' : '255,211,106',
              mode: 'expand'
            });
          }
          return;
        }
        feverShockwaves.push({
          x, y,
          t: 0,
          life: feverFx.exitDuration + 0.18,
          startR: Math.max(canvas.width, canvas.height) * 0.46,
          endR: 24,
          width: 12,
          color: '255,255,255',
          mode: 'collapse'
        });
      }

      function spawnFeverEntrySparks(x, y) {
        const density = getRuntimeFxDensity();
        const count = Math.max(10, Math.round((reducedMotionQuery.matches ? 14 : 30) * density));
        for (let i=0; i<count; i++) {
          const angle = (Math.PI * 2 * i / count) + rand(-0.18, 0.18);
          const speed = rand(210, 640) * (0.52 + density * 0.48);
          feverSparks.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - rand(10, 56),
            t: 0,
            life: rand(0.34, 0.82),
            size: rand(2.0, 5.0),
            tone: i % 3,
            mode: 'burst'
          });
        }
      }

      function spawnFeverExitConverge() {
        const cx = canvas.width * 0.5;
        const cy = canvas.height * 0.32;
        const density = getRuntimeFxDensity();
        const count = Math.max(8, Math.round((reducedMotionQuery.matches ? 12 : 22) * density));
        for (let i=0; i<count; i++) {
          const edge = i % 4;
          let x = 0;
          let y = 0;
          if (edge === 0) { x = rand(0, canvas.width); y = -8; }
          if (edge === 1) { x = canvas.width + 8; y = rand(0, canvas.height); }
          if (edge === 2) { x = rand(0, canvas.width); y = canvas.height + 8; }
          if (edge === 3) { x = -8; y = rand(0, canvas.height); }
          const dx = cx - x;
          const dy = cy - y;
          const dist = Math.hypot(dx, dy) || 1;
          const speed = dist / rand(0.42, 0.76);
          feverSparks.push({
            x, y,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            t: 0,
            life: rand(0.46, 0.82),
            size: rand(1.8, 4.1),
            tone: i % 3,
            mode: 'converge'
          });
        }
      }

      function spawnShootingStar(intensity = 1) {
        const heading = rand(Math.PI * 0.80, Math.PI * 0.90);
        const speed = rand(620, 1060) * (reducedMotionQuery.matches ? 0.64 : 1) * (0.82 + intensity * 0.25);
        const len = rand(76, 168);
        shootingStars.push({
          x: rand(canvas.width * 0.08, canvas.width * 0.92),
          y: rand(-canvas.height * 0.2, canvas.height * 0.36),
          vx: Math.cos(heading) * speed,
          vy: Math.sin(heading) * speed,
          life: rand(0.42, 0.72),
          t: 0,
          len,
          width: rand(1.3, 2.9),
          tone: Math.random() > 0.5 ? '#9fd8ff' : '#ffe39a'
        });
      }

      function triggerFeverHitFeedback(x, y, color='#ffd670') {
        const density = getRuntimeFxDensity();
        const burstLife = reducedMotionQuery.matches ? 0.24 : 0.32;
        feverHitBursts.push({
          x, y,
          color,
          t: 0,
          life: burstLife,
          r0: 10,
          r1: 58
        });
        feverFx.hitPulse = clamp(feverFx.hitPulse + (reducedMotionQuery.matches ? 0.24 : 0.38), 0, 1.25);
        scorePulse = clamp(scorePulse + (fever ? 0.78 : 0.44), 0, 1.35);

        const sparkCount = Math.max(4, Math.round((reducedMotionQuery.matches ? 4 : 10) * density));
        for (let i=0; i<sparkCount; i++) {
          const angle = (Math.PI * 2 * i / sparkCount) + rand(-0.24, 0.24);
          const speed = rand(120, 340);
          feverSparks.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            t: 0,
            life: rand(0.16, 0.34),
            size: rand(1.2, 3.2),
            tone: i % 3,
            mode: 'hit'
          });
        }
      }

      function setFeverPhase(nextPhase, nowSec, originX = canvas.width * 0.5, originY = canvas.height * 0.35) {
        if (nextPhase === 'enter') {
          feverFx.phase = 'enter';
          feverFx.phaseStart = nowSec;
          feverFx.enterDuration = reducedMotionQuery.matches ? 0.64 : FEVER_ENTER_DURATION;
          feverFx.exitDuration = reducedMotionQuery.matches ? 0.44 : FEVER_EXIT_DURATION;
          feverFx.originX = originX;
          feverFx.originY = originY;
          feverFx.flash = reducedMotionQuery.matches ? 0.26 : 0.78;
          feverFx.hitPulse = reducedMotionQuery.matches ? 0.26 : 0.52;
          feverBadge.classList.add('show', 'fever-neon');
          feverBadge.dataset.phase = 'enter';
          spawnFeverShockwave(originX, originY, 'entry');
          spawnFeverEntrySparks(originX, originY);
          updateScoreCardState();
          return;
        }
        if (nextPhase === 'active') {
          feverFx.phase = 'active';
          feverFx.phaseStart = nowSec;
          feverBadge.classList.add('show', 'fever-neon');
          feverBadge.dataset.phase = 'active';
          updateScoreCardState();
          return;
        }
        if (nextPhase === 'exit') {
          feverFx.phase = 'exit';
          feverFx.phaseStart = nowSec;
          feverFx.flash = Math.max(feverFx.flash, reducedMotionQuery.matches ? 0.18 : 0.34);
          feverFx.hitPulse = Math.max(feverFx.hitPulse, reducedMotionQuery.matches ? 0.2 : 0.32);
          feverBadge.classList.add('show', 'fever-neon');
          feverBadge.dataset.phase = 'exit';
          spawnFeverShockwave(canvas.width * 0.5, canvas.height * 0.32, 'exit');
          spawnFeverExitConverge();
          updateScoreCardState();
          return;
        }
        feverFx.phase = 'idle';
        feverFx.phaseStart = nowSec;
        feverFx.flash = 0;
        feverFx.hitPulse = 0;
        feverBadge.dataset.phase = 'idle';
        feverBadge.classList.remove('fever-neon');
        if (!fever) feverBadge.classList.remove('show');
        updateScoreCardState();
      }

      function getFeverVisualState(nowSec) {
        if (feverFx.phase === 'idle') {
          return { phase:'idle', intensity:0, enterT:0, exitT:0 };
        }
        if (feverFx.phase === 'enter') {
          const t = clamp((nowSec - feverFx.phaseStart) / feverFx.enterDuration, 0, 1);
          const intensity = clamp(0.48 + easeOutCubic(t) * 0.56 + feverFx.hitPulse * 0.22, 0, 1.24);
          return { phase:'enter', intensity, enterT:t, exitT:0 };
        }
        if (feverFx.phase === 'active') {
          const intensity = clamp(0.88 + feverFx.hitPulse * 0.22, 0, 1.22);
          return { phase:'active', intensity, enterT:1, exitT:0 };
        }
        const t = clamp((nowSec - feverFx.phaseStart) / feverFx.exitDuration, 0, 1);
        const intensity = clamp((0.92 - easeInCubic(t) * 0.92) + feverFx.hitPulse * 0.16, 0, 1.0);
        return { phase:'exit', intensity, enterT:1, exitT:t };
      }

      function updateFeverEffects(dt) {
        const targetQuality = dt > 0.029 ? 0.68 : dt > 0.024 ? 0.84 : 1.0;
        runtimeFxQuality += (targetQuality - runtimeFxQuality) * Math.min(1, dt * 4.2);
        runtimeFxQuality = clamp(runtimeFxQuality, 0.58, 1.0);

        scorePulse = Math.max(0, scorePulse - dt * (reducedMotionQuery.matches ? 4.1 : 6.1));
        feverFx.hitPulse = Math.max(0, feverFx.hitPulse - dt * (reducedMotionQuery.matches ? 2.7 : 4.4));
        feverFx.flash = Math.max(0, feverFx.flash - dt * (reducedMotionQuery.matches ? 1.7 : 2.6));

        const state = getFeverVisualState(totalElapsed);
        if (feverFx.phase === 'enter' && state.enterT >= 1) {
          setFeverPhase('active', totalElapsed);
        } else if (feverFx.phase === 'exit' && state.exitT >= 1) {
          setFeverPhase('idle', totalElapsed);
        }

        const meteorActive = fever || state.intensity > 0.06;
        if (meteorActive) {
          shootingStarSpawnTimer += dt;
          const interval = reducedMotionQuery.matches ? 0.34 : (0.20 - state.intensity * 0.08);
          while (shootingStarSpawnTimer >= interval) {
            shootingStarSpawnTimer -= interval * rand(0.72, 1.08);
            spawnShootingStar(state.intensity);
          }
        } else {
          shootingStarSpawnTimer = 0;
        }

        for (let i=feverShockwaves.length-1; i>=0; i--) {
          const w = feverShockwaves[i];
          w.t += dt;
          if (w.t > w.life) feverShockwaves.splice(i, 1);
        }

        for (let i=feverSparks.length-1; i>=0; i--) {
          const s = feverSparks[i];
          s.t += dt;
          if (s.t > s.life) { feverSparks.splice(i, 1); continue; }
          if (s.mode !== 'converge') s.vy += 320 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
        }

        for (let i=feverHitBursts.length-1; i>=0; i--) {
          feverHitBursts[i].t += dt;
          if (feverHitBursts[i].t > feverHitBursts[i].life) feverHitBursts.splice(i, 1);
        }

        for (let i=shootingStars.length-1; i>=0; i--) {
          const s = shootingStars[i];
          s.t += dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (s.t > s.life || s.x + s.len < -40 || s.y - s.len > canvas.height + 40) {
            shootingStars.splice(i, 1);
          }
        }

        updateScorePulseStyles();
      }

      function detectDeviceType() {
        const touchPoints = navigator.maxTouchPoints || 0;
        const coarsePointer = coarsePointerQuery.matches;
        const width = window.innerWidth;
        const dpr = window.devicePixelRatio || 1;
        const touchCapable = touchPoints > 0 || coarsePointer;

        if ((touchCapable && width <= 760) || width <= 430) return 'mobile';
        if ((touchCapable && width <= 1180) || (width <= 1024 && dpr >= 1.25)) return 'tablet';
        return 'desktop';
      }

      function applyResponsiveProfile() {
        const dpr = window.devicePixelRatio || 1;
        const coarsePointer = coarsePointerQuery.matches;
        const reducedMotion = reducedMotionQuery.matches;
        const prevCanvasW = canvas.width;
        const prevCanvasH = canvas.height;
        const canvasRect = canvas.getBoundingClientRect();
        const nextCanvasW = Math.max(320, Math.round(canvasRect.width || canvas.clientWidth || prevCanvasW));
        const nextCanvasH = Math.max(180, Math.round(canvasRect.height || canvas.clientHeight || prevCanvasH));
        const deviceType = detectDeviceType();
        const preset = DEVICE_PRESETS[deviceType];
        const targetCanvasW = deviceType === 'desktop' ? BASE_CANVAS_W : nextCanvasW;
        const targetCanvasH = deviceType === 'desktop' ? BASE_CANVAS_H : nextCanvasH;

        if (targetCanvasW !== prevCanvasW || targetCanvasH !== prevCanvasH) {
          const scaleX = targetCanvasW / prevCanvasW;
          const scaleY = targetCanvasH / prevCanvasH;
          canvas.width = targetCanvasW;
          canvas.height = targetCanvasH;

          if (Number.isFinite(scaleX) && Number.isFinite(scaleY) && scaleX > 0 && scaleY > 0) {
            basket.x *= scaleX;
            if (basket.targetX != null) basket.targetX *= scaleX;
            for (const o of objects) {
              o.x *= scaleX;
              o.y *= scaleY;
              o.r *= Math.min(scaleX, scaleY);
            }
            for (const p of pops) {
              p.x *= scaleX;
              p.y *= scaleY;
            }
            for (const ft of floatTexts) {
              ft.x *= scaleX;
              ft.y *= scaleY;
            }
            for (const fx of impactFxQueue) {
              fx.x *= scaleX;
              fx.y *= scaleY;
              fx.r *= Math.min(scaleX, scaleY);
            }
            for (const w of feverShockwaves) {
              w.x *= scaleX;
              w.y *= scaleY;
              w.startR *= Math.min(scaleX, scaleY);
              w.endR *= Math.min(scaleX, scaleY);
              w.width *= Math.min(scaleX, scaleY);
            }
            for (const s of feverSparks) {
              s.x *= scaleX;
              s.y *= scaleY;
            }
            for (const hb of feverHitBursts) {
              hb.x *= scaleX;
              hb.y *= scaleY;
              hb.r0 *= Math.min(scaleX, scaleY);
              hb.r1 *= Math.min(scaleX, scaleY);
            }
            feverFx.originX *= scaleX;
            feverFx.originY *= scaleY;
          }
        }

        const dprFxPenalty = dpr >= 3 ? 0.90 : dpr >= 2 ? 0.95 : 1.0;
        const reducedFxMul = reducedMotion
          ? (deviceType === 'mobile' ? 0.50 : deviceType === 'tablet' ? 0.58 : 0.64)
          : 1.0;
        const motionScale = reducedMotion ? (deviceType === 'mobile' ? 0.45 : 0.55) : 1.0;
        const hudScale = clamp(preset.hudScale * (coarsePointer ? 1.02 : 1.0), 0.78, 1.08);
        const uiScale = clamp(preset.uiScale * (coarsePointer ? 1.01 : 1.0), 0.80, 1.10);
        const fx = clamp(preset.fxDensity * dprFxPenalty * reducedFxMul, 0.18, 1.00);
        const pauseScale = clamp(preset.pauseScale * motionScale, 0.62, 1.02);
        const tapTargetPx = Math.max(preset.tapTarget, coarsePointer ? 44 : preset.tapTarget);
        // Keep HUD anchor stable across mobile/desktop with one viewport-based rule.
        const shortEdge = Math.max(320, Math.min(window.innerWidth, window.innerHeight));
        const hudTop = Math.round(clamp(shortEdge * 0.017, 8, 14));
        const hudSide = Math.round(clamp(shortEdge * 0.015, 8, 14));

        root.dataset.device = deviceType;
        root.dataset.motion = reducedMotion ? 'reduced' : 'full';

        root.style.setProperty('--ui-scale', uiScale.toFixed(3));
        root.style.setProperty('--hud-scale', hudScale.toFixed(3));
        root.style.setProperty('--title-scale', preset.titleScale.toFixed(3));
        root.style.setProperty('--fx-density', fx.toFixed(3));
        root.style.setProperty('--fruit-scale', preset.fruitScale.toFixed(3));
        root.style.setProperty('--basket-scale', preset.basketScale.toFixed(3));
        root.style.setProperty('--pause-scale', pauseScale.toFixed(3));
        root.style.setProperty('--motion-scale', motionScale.toFixed(3));
        root.style.setProperty('--tap-target', `${tapTargetPx}px`);
        root.style.setProperty('--hud-inset-top', `${hudTop}px`);
        root.style.setProperty('--hud-inset-side', `${hudSide}px`);

        fxDensity = fx;
        particleDensity = clamp(fx * (reducedMotion ? 0.65 : 0.92), 0.14, 1.06);
        backgroundMotionScale = clamp(motionScale * (reducedMotion ? 0.88 : 1.00), 0.32, 1.00);
        rotationMotionScale = clamp(motionScale * (reducedMotion ? 0.78 : 1.00), 0.28, 1.00);
        floatTextScale = clamp(uiScale, 0.82, 1.05);
        rebuildFeverStreams();

        const prevMinX = basket.w / 2 + 14;
        const prevMaxX = canvas.width - basket.w / 2 - 14;
        const prevSpan = Math.max(1, prevMaxX - prevMinX);
        const normalizedX = clamp((basket.x - prevMinX) / prevSpan, 0, 1);

        basket.w = BASE_BASKET_W * preset.basketScale;
        basket.h = BASE_BASKET_H * preset.basketScale;
        basket.y = canvas.height - Math.max(76, canvas.height * 0.125);

        const minX = basket.w / 2 + 14;
        const maxX = canvas.width - basket.w / 2 - 14;
        basket.x = minX + normalizedX * Math.max(1, maxX - minX);
        basket.targetX = basket.targetX == null ? null : clamp(basket.targetX, minX, maxX);

        const basketBodyRect = getBasketBodyRect();
        const basketBodyWidth = Math.max(1, Number.isFinite(basketBodyRect?.w) ? basketBodyRect.w : basket.w);
        const fruitBaseDiameter = basketBodyWidth * 0.75;
        const fruitDiameterMin = fruitBaseDiameter * 0.90;
        const fruitDiameterMax = fruitBaseDiameter * 1.10;
        fruitRadiusMin = (fruitDiameterMin * preset.fruitScale) / 2;
        fruitRadiusMax = (fruitDiameterMax * preset.fruitScale) / 2;
      }

      let responsiveRaf = null;
      function scheduleResponsiveProfileApply() {
        if (responsiveRaf != null) return;
        responsiveRaf = requestAnimationFrame(() => {
          responsiveRaf = null;
          applyResponsiveProfile();
        });
      }

      function updateDrawFixScale() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height || !canvas.width || !canvas.height) {
          drawFixScaleY = 1;
          return;
        }
        const sx = rect.width / canvas.width;
        const sy = rect.height / canvas.height;
        if (!sx || !sy) {
          drawFixScaleY = 1;
          return;
        }
        drawFixScaleY = clamp(sx / sy, 0.55, 1.65);
      }

      function updateHearts() {
        ui.updateHearts({
          heartsEl,
          maxMisses: MAX_MISSES,
          misses,
          onApplyLifeStateClasses: applyLifeStateClasses
        });
      }

      function resetOverlayTextToStart() {
        ui.resetOverlayTextToStart({
          overlay,
          startBtn
        });
      }

      function resetState() {
        score = 0;
        misses = 0;
        objects.length = 0;
        pops.length = 0;
        floatTexts.length = 0;
        impactFxQueue.length = 0;
        shootingStars.length = 0;
        totalElapsed = 0;
        fever = false;
        feverEnd = 0;
        gameOver = false;
        paused = false;
        damageFlash = 0;
        shootingStarSpawnTimer = 0;
        if (lifeFxTimeout) {
          clearTimeout(lifeFxTimeout);
          lifeFxTimeout = null;
        }
        wrapEl.classList.remove('damage-1', 'damage-2', 'damage-3', 'life-caution', 'life-critical');
        heartsEl.classList.remove('hit', 'life-critical');

        basket.x = canvas.width/2;
        basket.y = canvas.height - Math.max(76, canvas.height * 0.125);
        basket.targetX = null;

        scoreEl.textContent = '0';
        feverTimeEl.textContent = `${FEVER_DURATION.toFixed(1)}s`;
        updateHearts();

        pauseBtn.disabled = false;
        clearFeverVisualState();
        feverBadge.classList.remove('show');
        updateScoreCardState();
        updatePausePanel();
        resetPlayMetrics();

        if (music && soundOn) {
          music.setEnabled(true);
          music.setMode('normal');
        }
      }

      async function prepareAssetsForStart(ticket) {
        try {
          await warmupAssetsWithTimeout();
        } catch (err) {
          console.warn('asset warmup failed', err);
        }
        if (ticket !== gameStartTicket) return false;
        const readyRatio = getAssetReadyRatio();
        if (readyRatio < ASSET_START_REQUIRED_RATIO) {
          console.warn('asset ready ratio below required threshold', {
            readyRatio: Number(readyRatio.toFixed(3)),
            requiredRatio: ASSET_START_REQUIRED_RATIO
          });
        }
        return true;
      }

      async function startGame() {
        const ticket = ++gameStartTicket;
        running = false;
        paused = false;
        overlay.classList.remove('show');
        resetState();
        pauseBtn.disabled = true;
        const canStart = await prepareAssetsForStart(ticket);
        if (!canStart || ticket !== gameStartTicket) return;
        running = true;
        paused = false;
        pauseBtn.disabled = false;
        updatePausePanel();

        if (audioCtx) audioCtx.resume?.();
        setMusicEnabled(soundOn);
      }

      async function restartGame() {
        const ticket = ++gameStartTicket;
        running = false;
        paused = false;
        overlay.classList.remove('show');
        resetState();
        pauseBtn.disabled = true;
        const canStart = await prepareAssetsForStart(ticket);
        if (!canStart || ticket !== gameStartTicket) return;
        running = true;
        paused = false;
        pauseBtn.disabled = false;
        updatePausePanel();

        if (audioCtx) audioCtx.resume?.();
        setMusicEnabled(soundOn);
      }

      function setPaused(nextPaused) {
        if (!running || gameOver) return;
        paused = !!nextPaused;
        pauseBtn.textContent = '一時停止';
        pauseBtn.disabled = paused;
        updatePausePanel();

        if (music) {
          if (paused) music.setEnabled(false);
          else setMusicEnabled(soundOn);
        }
      }

      function togglePause() {
        if (!running || gameOver) return;
        setPaused(!paused);
      }

      function endGame() {
        gameOver = true;
        running = false;
        paused = false;
        pauseBtn.disabled = false;
        fever = false;
        clearFeverVisualState();
        feverBadge.classList.remove('show');
        updatePausePanel();

        if (music) music.setEnabled(false);

        ui.showGameOverOverlay({
          overlay,
          startBtn,
          score
        });
      }

      // Particles & float text
      function pop(x, y, color, n=14) {
        const count = Math.max(2, Math.round(n * particleDensity));
        const velocityScale = 0.70 + particleDensity * 0.50;
        const radiusScale = 0.75 + particleDensity * 0.35;
        for (let i=0;i<count;i++){
          pops.push({
            x, y,
            vx: (Math.random()*2-1) * 420 * velocityScale,
            vy: ((Math.random()*2-1) * 420 - 120) * velocityScale,
            r: (Math.random()*6 + 3) * radiusScale,
            life: 0.5 + Math.random()*0.22,
            t: 0,
            color
          });
        }
      }

      function addFloatText(x, y, text, color) {
        floatTexts.push({
          x, y,
          vy: -90,
          t: 0,
          life: 0.85,
          text,
          color
        });
      }

      function spawnImpactFx(fxKey, x, y, r, rot = 0, options = null) {
        if (!FEATURE_FLAGS.USE_IMAGE_FX) return false;
        const img = getImageOrNull(fxKey);
        if (!img) return false;
        const cap = getFxQueueLimit();
        while (impactFxQueue.length >= cap) impactFxQueue.shift();
        const baseLife = fxKey === 'fx_star_burst' ? 0.46 : fxKey === 'fx_bug_hit' ? 0.40 : 0.34;
        const baseScale = fxKey === 'fx_star_burst' ? 1.50 : fxKey === 'fx_bug_hit' ? 1.95 : 1.00;
        const quality = clamp(runtimeFxQuality, 0.58, 1.0);
        const lifeMul = quality < 0.72 ? 0.72 : quality < 0.86 ? 0.86 : 1.0;
        const alphaMul = quality < 0.72 ? 0.78 : quality < 0.86 ? 0.90 : 1.0;
        impactFxQueue.push({
          fxKey,
          x,
          y,
          r,
          rot,
          life: baseLife * lifeMul,
          t: 0,
          alpha: alphaMul,
          scale: baseScale,
          tintColor: options?.tintColor || null
        });
        return true;
      }

      function spawnLegacyImpactPop(o) {
        if (o.kind === 'star') {
          pop(o.x, o.y, '#ffd670', 34);
          pop(o.x, o.y, '#ff70a6', 28);
          pop(o.x, o.y, '#9b5de5', 20);
          return;
        }
        if (o.kind === 'bug') {
          pop(o.x, o.y, '#d6505d', 24);
          pop(o.x, o.y, '#78311f', 16);
          return;
        }
        pop(o.x, o.y, o.color, fever ? 30 : 14);
      }

      function spawnImpactByEvent(o) {
        const fxKey = getFxKeyForObject(o);
        const tintColor = o.kind === 'fruit'
          ? getFruitPopTintColor(o.fruitKind)
          : null;
        if (spawnImpactFx(fxKey, o.x, o.y, o.r, o.rot, { tintColor })) return;
        spawnLegacyImpactPop(o);
      }

      function updateImpactFx(dt) {
        if (!FEATURE_FLAGS.USE_IMAGE_FX) {
          impactFxQueue.length = 0;
          return;
        }
        for (let i = impactFxQueue.length - 1; i >= 0; i--) {
          const fx = impactFxQueue[i];
          fx.t += dt;
          if (fx.t > fx.life) impactFxQueue.splice(i, 1);
        }
      }

      function drawImpactFx() {
        if (!FEATURE_FLAGS.USE_IMAGE_FX) return;
        if (!impactFxQueue.length) return;
        const quality = clamp(runtimeFxQuality, 0.58, 1.0);
        ctx.save();
        for (const fx of impactFxQueue) {
          const img = getImageOrNull(fx.fxKey);
          if (!img) continue;
          const meta = spriteMeta[fx.fxKey] || {};
          const collisionRadiusPx = meta.collisionRadiusPx || Math.max(1, (img.naturalWidth || img.width) * 0.5);
          const scale = (fx.r / collisionRadiusPx) * (meta.drawScale ?? 1) * fx.scale;
          if (!Number.isFinite(scale) || scale <= 0) continue;
          let drawW = (img.naturalWidth || img.width) * scale;
          let drawH = (img.naturalHeight || img.height) * scale;
          if (drawW <= 0 || drawH <= 0) continue;

          const lifeK = clamp(1 - (fx.t / Math.max(0.0001, fx.life)), 0, 1);
          const isFruitPopFx = fx.fxKey === 'fx_fruit_pop';
          const keepRawFxColor = fx.fxKey === 'fx_star_burst' || fx.fxKey === 'fx_bug_hit';
          const alphaBase = lifeK * fx.alpha * (quality < 0.72 ? 0.86 : 1.0);
          const alpha = alphaBase * (isFruitPopFx ? 0.90 : 1.0);
          if (alpha <= 0.01) continue;

          let drawSource = img;
          let rasterKey = fx.fxKey;
          if (isFruitPopFx && fx.tintColor) {
            const tintedSource = getFruitPopTintSource(img, fx.tintColor);
            if (tintedSource) {
              drawSource = tintedSource;
              const tintKey = normalizeHexColor(fx.tintColor) || fx.tintColor;
              rasterKey = `${fx.fxKey}:tint:${tintKey}`;
            }
          }

          const raster = getSpriteRaster(rasterKey, drawSource, drawW, drawH);
          if (raster) {
            drawW = raster.drawW;
            drawH = raster.drawH;
          }

          const anchorX = meta.anchorX ?? 0.5;
          const anchorY = meta.anchorY ?? 0.5;
          ctx.save();
          ctx.globalCompositeOperation = (isFruitPopFx || keepRawFxColor) ? 'source-over' : 'lighter';
          if (isFruitPopFx) {
            ctx.filter = 'saturate(1.2) contrast(1.12) brightness(0.94)';
          }
          ctx.globalAlpha = alpha;
          ctx.translate(fx.x, fx.y);
          ctx.scale(1, drawFixScaleY);
          ctx.rotate(fx.rot + fx.t * 1.2);
          if (raster) {
            ctx.drawImage(raster.canvas, -drawW * anchorX, -drawH * anchorY, drawW, drawH);
          } else {
            ctx.drawImage(drawSource, -drawW * anchorX, -drawH * anchorY, drawW, drawH);
          }
          ctx.restore();
        }
        ctx.restore();
      }

      // Collision (match visual basket body)
      function intersectsCircleRect(cx, cy, r, rx, ry, rw, rh) {
        const x = clamp(cx, rx, rx + rw);
        const y = clamp(cy, ry, ry + rh);
        const dx = cx - x;
        const dy = cy - y;
        return (dx*dx + dy*dy) <= r*r;
      }

      function getBasketBodyRect() {
        if (FEATURE_FLAGS.USE_IMAGE_BASKET) {
          const metrics = getBasketSpriteMetrics();
          if (metrics) {
            return {
              x: metrics.bodyX,
              y: metrics.bodyY,
              w: metrics.bodyW,
              h: metrics.bodyH
            };
          }
        }
        return {
          x: basket.x - basket.w / 2,
          y: basket.y - basket.h / 2,
          w: basket.w,
          h: basket.h
        };
      }

      function intersectsObjBasket(o) {
        const bodyRect = getBasketBodyRect();
        const bx = bodyRect.x;
        const by = bodyRect.y;
        const bw = bodyRect.w;
        const bh = bodyRect.h;
        const insetX = Math.max(8, bw * 0.085);
        const insetTop = Math.max(4, bh * 0.14);
        const insetBottom = Math.max(2, bh * 0.10);
        const hitX = bx + insetX;
        const hitY = by + insetTop;
        const hitW = Math.max(12, bw - insetX * 2);
        const hitH = Math.max(10, bh - insetTop - insetBottom);
        return intersectsCircleRect(o.x, o.y, o.r, hitX, hitY, hitW, hitH);
      }

      // Spawning
      let spawnTimer = 0;

      function globalSpeedMultiplier() {
        // every 30 sec +10%
        const steps = Math.floor(totalElapsed / 30);
        return Math.pow(1.10, steps);
      }

      function spawnObject() {
        const starChance = fever ? STAR_CHANCE_FEVER : STAR_CHANCE_NORMAL;
        const hazardChance = fever ? HAZARD_CHANCE_FEVER : HAZARD_CHANCE_NORMAL;
        const roll = Math.random();
        const isStar = roll < starChance;
        const isHazard = !isStar && roll < (starChance + hazardChance);

        if (isStar) {
          const r = GRAPE_FRUIT ? getFruitRadiusForMul(GRAPE_FRUIT.mul) : clamp((fruitRadiusMin + fruitRadiusMax) * 0.44, 18, 36);
          const x = rand(r + 18, canvas.width - r - 18);
          objects.push({
            kind: 'star',
            fruitKind: STAR.kind,
            x, y: -r - 10,
            r,
            baseMul: 1.00,
            points: 0,
            color: STAR.color,
            rot: rand(0, Math.PI*2),
            spin: rand(-2.8, 2.8),
            vyBase: baseFallSpeed() * 1.05
          });
          return;
        }

        if (isHazard) {
          const r = clamp((fruitRadiusMin + fruitRadiusMax) * 0.42, 18, 34);
          const x = rand(r + 18, canvas.width - r - 18);
          objects.push({
            kind: 'bug',
            fruitKind: HAZARD.kind,
            x, y: -r - 10,
            r,
            baseMul: 1.04,
            points: 0,
            color: HAZARD.color,
            rot: rand(0, Math.PI*2),
            spin: rand(-3.2, 3.2),
            vyBase: baseFallSpeed() * 1.08
          });
          return;
        }

        const t = FRUITS[Math.floor(Math.random()*FRUITS.length)];
        const r = getFruitRadiusForMul(t.mul);
        const x = rand(r + 18, canvas.width - r - 18);
        objects.push({
          kind: 'fruit',
          fruitKind: t.kind,
          x, y: -r - 10,
          r,
          baseMul: t.mul,
          points: t.points,
          color: t.color,
          rot: rand(0, Math.PI*2),
          spin: rand(-2.2, 2.2),
          vyBase: baseFallSpeed()
        });
      }

      // Drawing helpers
      function roundedRect(x,y,w,h,r){
        const rr = Math.min(r, w/2, h/2);
        ctx.beginPath();
        ctx.moveTo(x+rr,y);
        ctx.arcTo(x+w,y,x+w,y+h,rr);
        ctx.arcTo(x+w,y+h,x,y+h,rr);
        ctx.arcTo(x,y+h,x,y,rr);
        ctx.arcTo(x,y,x+w,y,rr);
        ctx.closePath();
      }

      function drawStarPath(outerR, innerR = outerR * 0.48) {
        ctx.beginPath();
        for (let i=0; i<10; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 5;
          const rr = (i % 2 === 0) ? outerR : innerR;
          const px = Math.cos(angle) * rr;
          const py = Math.sin(angle) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }

      function getFruitStyle(fruitKind) {
        switch (fruitKind) {
          case 'banana':
            return {
              kind: 'banana',
              base: '#ffd93c',
              shade: '#c98a13',
              highlight: '#fff7b8',
              stem: '#8d5e1c',
              leaf: '#63bf53'
            };
          case 'apple':
            return {
              kind: 'apple',
              base: '#ff475f',
              shade: '#a91f38',
              highlight: '#ffd1d2',
              stem: '#6d4022',
              leaf: '#62b54d'
            };
          case 'orange':
            return {
              kind: 'orange',
              base: '#ffab2e',
              shade: '#c45b10',
              highlight: '#ffe4af',
              stem: '#7b4d27',
              leaf: '#5fb754'
            };
          case 'peach':
            return {
              kind: 'peach',
              base: '#ffb27f',
              shade: '#d65c66',
              highlight: '#ffe5c7',
              stem: '#7e4a27',
              leaf: '#69bd53'
            };
          case 'strawberry':
            return {
              kind: 'strawberry',
              base: '#ff3e6f',
              shade: '#9f173c',
              highlight: '#ffc4d6',
              stem: '#6f3f1f',
              leaf: '#62bf53',
              seed: '#ffe9b5'
            };
          case 'grape':
            return {
              kind: 'grape',
              base: '#7d66f3',
              shade: '#42238f',
              highlight: '#d8ceff',
              stem: '#70411f',
              leaf: '#67b853',
              seed: '#d6c5ff'
            };
          case 'watermelon':
            return {
              kind: 'watermelon',
              base: '#43cb80',
              shade: '#1f7f46',
              highlight: '#b4f7d2',
              stem: '#70411f',
              leaf: '#65b753',
              seed: '#222334'
            };
          default:
            return {
              kind: 'orange',
              base: '#ffae54',
              shade: '#b4621d',
              highlight: '#ffe5bf',
              stem: '#7b4d27',
              leaf: '#63b857'
            };
        }
      }

      function drawRoundFruit(style, r) {
        const body = ctx.createRadialGradient(-r*0.36, -r*0.45, r*0.15, 0, 0, r*1.15);
        body.addColorStop(0, style.highlight);
        body.addColorStop(0.58, style.base);
        body.addColorStop(1, style.shade);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = Math.max(1.6, r * 0.08);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,.34)';
        ctx.beginPath();
        ctx.ellipse(-r*0.34, -r*0.38, r*0.24, r*0.14, -0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = style.stem;
        ctx.lineWidth = Math.max(2, r * 0.12);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r*0.04, -r*0.88);
        ctx.quadraticCurveTo(0, -r*1.12, r*0.1, -r*0.96);
        ctx.stroke();

        ctx.fillStyle = style.leaf;
        ctx.beginPath();
        ctx.moveTo(r*0.02, -r*0.92);
        ctx.quadraticCurveTo(r*0.34, -r*1.06, r*0.36, -r*0.78);
        ctx.quadraticCurveTo(r*0.18, -r*0.68, r*0.02, -r*0.92);
        ctx.fill();
      }

      function drawApple(style, r) {
        const body = ctx.createRadialGradient(-r * 0.34, -r * 0.46, r * 0.16, 0, 0, r * 1.15);
        body.addColorStop(0, style.highlight);
        body.addColorStop(0.58, style.base);
        body.addColorStop(1, style.shade);
        ctx.fillStyle = body;

        ctx.beginPath();
        ctx.moveTo(0, -r * 0.92);
        ctx.bezierCurveTo(r * 0.72, -r * 1.02, r * 1.0, -r * 0.06, r * 0.52, r * 0.74);
        ctx.bezierCurveTo(r * 0.26, r * 0.98, -r * 0.26, r * 0.98, -r * 0.52, r * 0.74);
        ctx.bezierCurveTo(-r * 1.0, -r * 0.06, -r * 0.72, -r * 1.02, 0, -r * 0.92);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,.32)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.23, r * 0.14, -0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = style.stem;
        ctx.lineWidth = Math.max(2, r * 0.12);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.88);
        ctx.quadraticCurveTo(r * 0.04, -r * 1.16, r * 0.12, -r * 0.98);
        ctx.stroke();

        ctx.fillStyle = style.leaf;
        ctx.beginPath();
        ctx.moveTo(r * 0.10, -r * 0.94);
        ctx.quadraticCurveTo(r * 0.46, -r * 1.07, r * 0.42, -r * 0.76);
        ctx.quadraticCurveTo(r * 0.23, -r * 0.68, r * 0.10, -r * 0.94);
        ctx.fill();
      }

      function drawOrange(style, r) {
        drawRoundFruit(style, r);
        const dots = Math.max(12, Math.round(r * 0.45));
        ctx.fillStyle = 'rgba(255,203,127,.45)';
        for (let i=0; i<dots; i++) {
          const a = (Math.PI * 2 * i / dots) + (i % 2 ? 0.2 : -0.12);
          const rr = r * rand(0.14, 0.76);
          ctx.beginPath();
          ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.04, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawPeach(style, r) {
        const body = ctx.createRadialGradient(-r * 0.28, -r * 0.42, r * 0.12, 0, 0, r * 1.12);
        body.addColorStop(0, style.highlight);
        body.addColorStop(0.55, style.base);
        body.addColorStop(1, style.shade);
        ctx.fillStyle = body;

        ctx.beginPath();
        ctx.moveTo(0, -r * 0.88);
        ctx.bezierCurveTo(r * 0.74, -r * 0.84, r * 0.86, r * 0.10, 0, r * 0.96);
        ctx.bezierCurveTo(-r * 0.86, r * 0.10, -r * 0.74, -r * 0.84, 0, -r * 0.88);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,126,136,.5)';
        ctx.lineWidth = Math.max(1.8, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.58);
        ctx.quadraticCurveTo(-r * 0.1, 0, 0, r * 0.74);
        ctx.stroke();

        ctx.strokeStyle = style.stem;
        ctx.lineWidth = Math.max(2, r * 0.12);
        ctx.beginPath();
        ctx.moveTo(r * 0.02, -r * 0.9);
        ctx.quadraticCurveTo(r * 0.04, -r * 1.1, r * 0.14, -r * 0.92);
        ctx.stroke();

        ctx.fillStyle = style.leaf;
        ctx.beginPath();
        ctx.moveTo(r * 0.12, -r * 0.9);
        ctx.quadraticCurveTo(r * 0.42, -r * 1.03, r * 0.38, -r * 0.76);
        ctx.quadraticCurveTo(r * 0.20, -r * 0.68, r * 0.12, -r * 0.9);
        ctx.fill();
      }

      function drawBanana(style, r) {
        ctx.rotate(-0.42);

        ctx.strokeStyle = style.shade;
        ctx.lineWidth = r * 0.54;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, Math.PI * 0.2, Math.PI * 1.1);
        ctx.stroke();

        const strip = ctx.createLinearGradient(-r, -r, r, r);
        strip.addColorStop(0, style.highlight);
        strip.addColorStop(0.55, style.base);
        strip.addColorStop(1, style.shade);
        ctx.strokeStyle = strip;
        ctx.lineWidth = r * 0.34;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, Math.PI * 0.2, Math.PI * 1.1);
        ctx.stroke();

        ctx.fillStyle = style.stem;
        ctx.beginPath();
        ctx.arc(-r*0.70, r*0.20, r*0.09, 0, Math.PI * 2);
        ctx.arc(r*0.36, -r*0.74, r*0.09, 0, Math.PI * 2);
        ctx.fill();
      }

      function drawStrawberry(style, r) {
        const body = ctx.createRadialGradient(-r*0.3, -r*0.48, r*0.12, 0, 0, r*1.08);
        body.addColorStop(0, style.highlight);
        body.addColorStop(0.6, style.base);
        body.addColorStop(1, style.shade);
        ctx.fillStyle = body;

        ctx.beginPath();
        ctx.moveTo(0, -r*0.95);
        ctx.bezierCurveTo(r*0.86, -r*0.82, r*0.9, r*0.24, 0, r*0.98);
        ctx.bezierCurveTo(-r*0.9, r*0.24, -r*0.86, -r*0.82, 0, -r*0.95);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,.3)';
        ctx.lineWidth = Math.max(1.2, r * 0.07);
        ctx.stroke();

        const seeds = Math.max(10, Math.round(r * 0.33));
        ctx.fillStyle = style.seed;
        for (let i=0; i<seeds; i++) {
          const ang = (Math.PI * 2 * i / seeds) + (i % 2 ? 0.14 : -0.1);
          const rr = r * rand(0.28, 0.74);
          const sx = Math.cos(ang) * rr * 0.9;
          const sy = Math.sin(ang) * rr * 1.05 + r * 0.08;
          ctx.beginPath();
          ctx.ellipse(sx, sy, r*0.05, r*0.03, ang, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = style.leaf;
        for (let i=0; i<5; i++) {
          const a = -Math.PI * 0.84 + i * (Math.PI * 0.17);
          ctx.beginPath();
          ctx.moveTo(0, -r*0.72);
          ctx.quadraticCurveTo(
            Math.cos(a) * r * 0.36,
            -r*1.12 + Math.sin(a) * r * 0.08,
            Math.cos(a) * r * 0.18,
            -r*0.72
          );
          ctx.fill();
        }
      }

      function drawGrape(style, r) {
        const bubbles = [
          {x:0, y:r*0.04, s:0.46},
          {x:-r*0.34, y:r*0.08, s:0.34},
          {x:r*0.34, y:r*0.08, s:0.34},
          {x:-r*0.20, y:-r*0.24, s:0.32},
          {x:r*0.20, y:-r*0.24, s:0.32},
          {x:0, y:-r*0.42, s:0.31}
        ];

        for (let i=0; i<bubbles.length; i++) {
          const b = bubbles[i];
          const rr = r * b.s;
          const g = ctx.createRadialGradient(
            b.x - rr * 0.3,
            b.y - rr * 0.35,
            rr * 0.12,
            b.x,
            b.y,
            rr * 1.1
          );
          g.addColorStop(0, style.highlight);
          g.addColorStop(0.6, style.base);
          g.addColorStop(1, style.shade);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255,255,255,.24)';
          ctx.lineWidth = Math.max(1, rr * 0.12);
          ctx.stroke();
        }

        ctx.strokeStyle = style.stem;
        ctx.lineWidth = Math.max(2, r * 0.11);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r*0.88);
        ctx.quadraticCurveTo(r*0.06, -r*1.08, r*0.2, -r*0.92);
        ctx.stroke();

        ctx.fillStyle = style.leaf;
        ctx.beginPath();
        ctx.moveTo(r*0.1, -r*0.86);
        ctx.quadraticCurveTo(r*0.46, -r*1.0, r*0.42, -r*0.72);
        ctx.quadraticCurveTo(r*0.20, -r*0.62, r*0.1, -r*0.86);
        ctx.fill();
      }

      function drawWatermelon(style, r) {
        const body = ctx.createRadialGradient(-r*0.34, -r*0.44, r*0.12, 0, 0, r*1.1);
        body.addColorStop(0, style.highlight);
        body.addColorStop(0.58, style.base);
        body.addColorStop(1, style.shade);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = 'rgba(26,128,63,.45)';
        ctx.lineWidth = Math.max(2, r * 0.12);
        for (let i=-2; i<=2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.34, -r * 0.9);
          ctx.quadraticCurveTo(i * r * 0.20, 0, i * r * 0.34, r * 0.9);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = '#f5ffe5';
        ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = style.seed;
        const seedCount = 6;
        for (let i=0; i<seedCount; i++) {
          const a = -Math.PI * 0.88 + i * (Math.PI * 0.35);
          const rr = r * (0.32 + (i % 2) * 0.14);
          ctx.save();
          ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr);
          ctx.rotate(a + Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, -r*0.06);
          ctx.quadraticCurveTo(r*0.05, 0, 0, r*0.09);
          ctx.quadraticCurveTo(-r*0.05, 0, 0, -r*0.06);
          ctx.fill();
          ctx.restore();
        }
      }

      function drawFruitVisibilityRing(r, tone) {
        ctx.save();
        ctx.globalAlpha = 0.90;
        ctx.strokeStyle = 'rgba(255,255,255,.92)';
        ctx.lineWidth = Math.max(2.2, r * 0.18);
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.03, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.50;
        ctx.strokeStyle = tone;
        ctx.lineWidth = Math.max(1.4, r * 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      function drawBug(r) {
        const wing = ctx.createLinearGradient(-r, -r * 0.1, r, r * 0.2);
        wing.addColorStop(0, 'rgba(255,248,237,.85)');
        wing.addColorStop(1, 'rgba(214,239,255,.65)');

        ctx.fillStyle = wing;
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, -r * 0.18, r * 0.44, r * 0.24, -0.38, 0, Math.PI * 2);
        ctx.ellipse(r * 0.35, -r * 0.18, r * 0.44, r * 0.24, 0.38, 0, Math.PI * 2);
        ctx.fill();

        const body = ctx.createLinearGradient(0, -r, 0, r);
        body.addColorStop(0, '#b56141');
        body.addColorStop(0.52, '#7b3f2f');
        body.addColorStop(1, '#4e2519');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.48, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,.44)';
        ctx.lineWidth = Math.max(1.2, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.52);
        ctx.lineTo(0, r * 0.48);
        ctx.stroke();

        ctx.strokeStyle = '#2d180f';
        ctx.lineWidth = Math.max(1.2, r * 0.09);
        for (let i=-1; i<=1; i+=2) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.20, -r * 0.05);
          ctx.lineTo(i * r * 0.72, -r * 0.30);
          ctx.moveTo(i * r * 0.25, r * 0.18);
          ctx.lineTo(i * r * 0.74, r * 0.12);
          ctx.moveTo(i * r * 0.16, r * 0.38);
          ctx.lineTo(i * r * 0.66, r * 0.42);
          ctx.stroke();
        }

        ctx.fillStyle = '#fbe7d2';
        ctx.beginPath();
        ctx.arc(-r * 0.16, -r * 0.12, r * 0.08, 0, Math.PI * 2);
        ctx.arc(r * 0.16, -r * 0.12, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }

      function drawFeverBackdrop(now, feverState, dynamicFx) {
        if (feverState.intensity <= 0.001) return;
        const intensity = feverState.intensity;
        const pulseFreq = reducedMotionQuery.matches ? 0.0043 : 0.0064;
        const pulse = 0.5 + 0.5 * Math.sin(now * pulseFreq * backgroundMotionScale + feverFx.hitPulse * 2.0);
        const centerX = feverFx.phase === 'enter' ? feverFx.originX : canvas.width * 0.5;
        const centerY = feverFx.phase === 'enter' ? feverFx.originY : canvas.height * 0.34;

        ctx.save();
        const warmWash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        warmWash.addColorStop(0, 'rgba(88,136,255,.38)');
        warmWash.addColorStop(0.55, 'rgba(152,112,255,.33)');
        warmWash.addColorStop(1, 'rgba(89,232,255,.34)');
        ctx.globalAlpha = (0.10 + pulse * 0.10) * intensity;
        ctx.fillStyle = warmWash;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        ctx.save();
        const aura = ctx.createRadialGradient(
          centerX,
          centerY,
          Math.max(24, canvas.width * 0.03),
          centerX,
          centerY,
          canvas.width * 0.52
        );
        aura.addColorStop(0, 'rgba(235,246,255,0.62)');
        aura.addColorStop(0.24, 'rgba(141,213,255,0.42)');
        aura.addColorStop(0.56, 'rgba(188,140,255,0.22)');
        aura.addColorStop(1, 'rgba(103,184,255,0)');
        ctx.globalAlpha = (0.14 + pulse * 0.12) * intensity;
        ctx.fillStyle = aura;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const streamAlpha = Math.min(0.34, (0.08 + intensity * 0.16) * (0.5 + dynamicFx * 0.5));
        if (streamAlpha > 0.01 && feverStreams.length) {
          const tones = ['#86d8ff', '#9ea7ff', '#ffd2fb'];
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let i=0; i<feverStreams.length; i++) {
            const s = feverStreams[i];
            const travel = ((now * 0.001 * (92 + s.speed * 86) * backgroundMotionScale) + s.seed * 0.73) % (canvas.width + s.len * 2);
            const x = travel - s.len;
            const y = canvas.height * s.lane + Math.sin(now * 0.0016 * s.speed + s.seed) * s.amp * (0.2 + intensity * 0.8);
            ctx.globalAlpha = streamAlpha * (0.6 + (s.tone % 3) * 0.14);
            ctx.strokeStyle = tones[s.tone % tones.length];
            ctx.lineWidth = s.width * (0.68 + intensity * 0.34);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + s.len, y - s.amp * 0.2);
            ctx.stroke();
          }
          ctx.restore();
        }

        if (feverFx.flash > 0.001) {
          ctx.save();
          ctx.globalAlpha = feverFx.flash * (reducedMotionQuery.matches ? 0.14 : 0.26);
          ctx.fillStyle = '#ddf5ff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        }
      }

      function drawFeverShockwavesLayer() {
        if (!feverShockwaves.length) return;
        const density = getRuntimeFxDensity();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const w of feverShockwaves) {
          if (w.t < 0) continue;
          const p = clamp(w.t / w.life, 0, 1);
          const k = w.mode === 'collapse' ? easeInCubic(p) : easeOutCubic(p);
          const radius = w.startR + (w.endR - w.startR) * k;
          const alpha = (1 - p) * (w.mode === 'collapse' ? 0.46 : 0.58) * (0.45 + density * 0.55);
          if (alpha <= 0.01) continue;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = `rgba(${w.color}, 1)`;
          ctx.lineWidth = Math.max(1.4, w.width * (1 - p * 0.78));
          ctx.beginPath();
          ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      function drawFeverSparkLayer() {
        if (!feverSparks.length) return;
        const toneColor = ['#ffe18f', '#ff8cbf', '#8bc9ff'];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const s of feverSparks) {
          const lifeK = 1 - (s.t / s.life);
          if (lifeK <= 0) continue;
          const trail = s.mode === 'converge' ? 0.020 : 0.03;
          const px = s.x - s.vx * trail;
          const py = s.y - s.vy * trail;
          ctx.globalAlpha = lifeK * (s.mode === 'hit' ? 0.88 : 0.76);
          ctx.strokeStyle = toneColor[s.tone % toneColor.length];
          ctx.lineWidth = Math.max(1.1, s.size * lifeK);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
          if (s.mode === 'hit') {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * lifeK * 0.75, 0, Math.PI * 2);
            ctx.fillStyle = toneColor[s.tone % toneColor.length];
            ctx.fill();
          }
        }
        ctx.restore();
      }

      function drawFeverHitBurstsLayer() {
        if (!feverHitBursts.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const hb of feverHitBursts) {
          const p = clamp(hb.t / hb.life, 0, 1);
          const lifeK = 1 - p;
          if (lifeK <= 0) continue;
          const ringR = hb.r0 + (hb.r1 - hb.r0) * easeOutCubic(p);
          ctx.globalAlpha = lifeK * 0.66;
          ctx.strokeStyle = hb.color;
          ctx.lineWidth = Math.max(1.2, 7 * lifeK);
          ctx.beginPath();
          ctx.arc(hb.x, hb.y, ringR, 0, Math.PI * 2);
          ctx.stroke();

          const cross = 6 + ringR * 0.24;
          ctx.lineWidth = Math.max(1.0, 4 * lifeK);
          ctx.beginPath();
          ctx.moveTo(hb.x - cross, hb.y);
          ctx.lineTo(hb.x + cross, hb.y);
          ctx.moveTo(hb.x, hb.y - cross);
          ctx.lineTo(hb.x, hb.y + cross);
          ctx.stroke();
        }
        ctx.restore();
      }

      function drawParallaxCloudLayer(now, dynamicFx, feverIntensity) {
        const cloudCount = Math.max(4, Math.round((6 + dynamicFx * 4) * (reducedMotionQuery.matches ? 0.7 : 1)));
        const tone = feverIntensity > 0.06 ? '#fff7eb' : '#ffffff';
        ctx.save();
        for (let i=0; i<cloudCount; i++) {
          const speed = 9 + i * 2.8;
          const travel = ((now * 0.010 * speed * backgroundMotionScale) + i * 230) % (canvas.width + 300);
          const x = travel - 150;
          const y = canvas.height * (0.09 + (i % 4) * 0.065) + Math.sin(now * 0.00045 + i) * 10;
          const w = 90 + (i % 3) * 28;
          const h = 30 + (i % 2) * 10;

          ctx.globalAlpha = (0.20 + (i % 3) * 0.06) * (0.7 + dynamicFx * 0.3);
          ctx.fillStyle = tone;
          ctx.beginPath();
          ctx.ellipse(x, y, w * 0.46, h * 0.5, 0, 0, Math.PI * 2);
          ctx.ellipse(x + w * 0.24, y - h * 0.16, w * 0.34, h * 0.42, 0, 0, Math.PI * 2);
          ctx.ellipse(x - w * 0.24, y - h * 0.10, w * 0.30, h * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      function drawTerrainLayer(baseY, amp, step, color, alpha, phase) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for (let x=0; x<=canvas.width + step; x+=step) {
          const y = baseY + Math.sin(x * 0.006 + phase) * amp + Math.sin(x * 0.013 + phase * 1.2) * amp * 0.42;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      function drawShootingStarsLayer() {
        if (!shootingStars.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const s of shootingStars) {
          const lifeK = 1 - (s.t / s.life);
          if (lifeK <= 0) continue;
          const tx = s.x - s.vx * 0.05;
          const ty = s.y - s.vy * 0.05;
          const trail = ctx.createLinearGradient(s.x, s.y, tx, ty);
          trail.addColorStop(0, s.tone);
          trail.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = lifeK * 0.92;
          ctx.strokeStyle = trail;
          ctx.lineWidth = s.width * (0.7 + lifeK * 0.7);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
        ctx.restore();
      }

      function drawNightCityBackdrop(now, dynamicFx, intensity) {
        const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
        sky.addColorStop(0, '#2e1d71');
        sky.addColorStop(0.34, '#6331ae');
        sky.addColorStop(0.68, '#a73fbe');
        sky.addColorStop(1, '#5a73cf');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        const aurora = ctx.createRadialGradient(
          canvas.width * 0.52,
          canvas.height * 0.08,
          12,
          canvas.width * 0.52,
          canvas.height * 0.12,
          canvas.width * 0.62
        );
        aurora.addColorStop(0, 'rgba(255,246,255,0.64)');
        aurora.addColorStop(0.36, 'rgba(255,149,238,0.38)');
        aurora.addColorStop(0.62, 'rgba(123,201,255,0.28)');
        aurora.addColorStop(1, 'rgba(118,171,255,0)');
        ctx.globalAlpha = 0.34 + intensity * 0.26;
        ctx.fillStyle = aurora;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const nebulaCount = Math.max(3, Math.round((4 + intensity * 4) * dynamicFx));
        ctx.save();
        for (let i=0; i<nebulaCount; i++) {
          const x = canvas.width * (0.16 + (i / (nebulaCount + 1)) * 0.72);
          const y = canvas.height * (0.13 + (i % 2) * 0.09);
          const w = canvas.width * (0.22 + (i % 3) * 0.07);
          const h = canvas.height * (0.12 + (i % 2) * 0.05);
          const hue = i % 2 === 0 ? '255,126,233' : '132,205,255';
          const cloud = ctx.createRadialGradient(x, y, 8, x, y, w);
          cloud.addColorStop(0, `rgba(${hue},0.44)`);
          cloud.addColorStop(0.58, `rgba(${hue},0.16)`);
          cloud.addColorStop(1, `rgba(${hue},0)`);
          ctx.globalAlpha = 0.42 + intensity * 0.28;
          ctx.fillStyle = cloud;
          ctx.fillRect(x - w, y - h, w * 2, h * 2);
        }
        ctx.restore();

        const sparkleCount = Math.max(38, Math.round((74 + intensity * 84) * dynamicFx));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i=0; i<sparkleCount; i++) {
          const x = (i * 131.71 + (i % 6) * 13.8) % canvas.width;
          const y = 12 + ((i * 69.07) % (canvas.height * 0.62));
          const twinkle = 0.34 + 0.66 * (0.5 + 0.5 * Math.sin(now * 0.0023 + i * 1.1));
          const r = (i % 3 ? 1.0 : 1.8) * (0.82 + intensity * 0.36);
          ctx.globalAlpha = twinkle * (0.36 + intensity * 0.38);
          ctx.fillStyle = i % 5 === 0 ? '#ffd5ff' : i % 5 === 1 ? '#ffd9aa' : i % 5 === 2 ? '#a9deff' : '#d1c2ff';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        drawShootingStarsLayer();
      }

      function drawBackground() {
        const now = performance.now();
        const dynamicFx = clamp(fxDensity * runtimeFxQuality, 0.18, 1.18);
        const feverState = getFeverVisualState(totalElapsed);
        const feverIntensity = feverState.intensity;
        const feverBoost = 1 + feverIntensity * (reducedMotionQuery.matches ? 0.18 : 0.34);
        const drift = now * 0.00024 * backgroundMotionScale * feverBoost;
        const nightBlend = clamp((feverIntensity - 0.08) / 0.38, 0, 1);

        const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
        sky.addColorStop(0, '#65c0ff');
        sky.addColorStop(0.5, '#a9ecff');
        sky.addColorStop(1, '#dbffc9');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (nightBlend > 0.001) {
          ctx.save();
          ctx.globalAlpha = 0.40 + nightBlend * 0.60;
          drawNightCityBackdrop(now, dynamicFx, clamp(0.66 + feverIntensity * 0.44, 0, 1.2));
          ctx.restore();
        }

        ctx.save();
        const sun = ctx.createRadialGradient(
          canvas.width * 0.82,
          canvas.height * 0.12,
          10,
          canvas.width * 0.82,
          canvas.height * 0.12,
          canvas.width * 0.16
        );
        sun.addColorStop(0, 'rgba(255,255,245,0.95)');
        sun.addColorStop(0.45, 'rgba(255,240,174,0.55)');
        sun.addColorStop(1, 'rgba(255,220,131,0)');
        ctx.globalAlpha = (0.55 + feverIntensity * 0.12) * (1 - nightBlend * 0.92);
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        drawParallaxCloudLayer(now, dynamicFx, feverIntensity * (1 - nightBlend * 0.45));
        drawFeverBackdrop(now, feverState, dynamicFx);

        drawTerrainLayer(
          canvas.height * 0.72,
          24,
          72,
          '#9fdfa3',
          0.62,
          drift * 0.84
        );

        drawTerrainLayer(
          canvas.height * 0.82,
          18,
          64,
          '#7fce7e',
          0.74,
          drift * 1.06 + 1.2
        );

        drawTerrainLayer(
          canvas.height * 0.90,
          14,
          56,
          '#63b95b',
          0.92,
          drift * 1.3 + 2.2
        );

        const moteCount = Math.max(6, Math.round((14 + feverIntensity * 12) * dynamicFx));
        ctx.save();
        ctx.globalAlpha = (0.18 + feverIntensity * 0.12) * (0.46 + dynamicFx * 0.54);
        for (let i=0; i<moteCount; i++) {
          const speed = (0.04 + feverIntensity * 0.04) * backgroundMotionScale;
          const x = (i * 137 + (now * speed)) % canvas.width;
          const y = 84 + (i * 49) % Math.max(180, Math.round(330 * (0.62 + dynamicFx * 0.38)));
          ctx.beginPath();
          ctx.arc(x, y, (2 + (i % 3)) * (0.75 + dynamicFx * 0.25), 0, Math.PI*2);
          ctx.fillStyle = ['#ff8eb9','#ffe18f','#8bd7ff','#b8ff9b','#ffffff'][i % 5];
          ctx.fill();
        }
        ctx.restore();

        drawFeverShockwavesLayer();
      }

      function drawBasket() {
        if (!FEATURE_FLAGS.USE_IMAGE_BASKET) {
          drawBasketFallback();
          return;
        }
        drawBasketSpriteOrFallback();
      }

      function getBasketSpriteMetrics() {
        const spriteKey = 'basket_default';
        const img = getImageOrNull(spriteKey);
        if (!img) return null;

        const meta = spriteMeta[spriteKey] || {};
        const anchorX = meta.anchorX ?? 0.5;
        const anchorY = meta.anchorY ?? 0.5;
        const imgW = Math.max(1, img.naturalWidth || img.width);
        const imgH = Math.max(1, img.naturalHeight || img.height);
        const bodyWidthPx = Math.max(1, meta.bodyWidthPx || imgW);
        const bodyHeightPx = Math.max(1, meta.bodyHeightPx || imgH);
        const scaleX = basket.w / bodyWidthPx;
        const scaleY = basket.h / bodyHeightPx;
        const scale = Math.max(0.0001, Math.min(scaleX, scaleY)) * (meta.drawScale ?? 1);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const drawX = basket.x - drawW * anchorX;
        const drawY = basket.y - drawH * anchorY;
        const bodyX = drawX + (imgW - bodyWidthPx) * 0.5 * scale;
        const bodyY = drawY + (imgH - bodyHeightPx) * 0.5 * scale;
        const bodyW = bodyWidthPx * scale;
        const bodyH = bodyHeightPx * scale;

        return {
          spriteKey,
          img,
          anchorX,
          anchorY,
          drawW,
          drawH,
          drawX,
          drawY,
          bodyX,
          bodyY,
          bodyW,
          bodyH
        };
      }

      function drawBasketSpriteOrFallback() {
        const metrics = getBasketSpriteMetrics();
        if (!metrics) {
          drawBasketFallback();
          return;
        }

        const { spriteKey, img, anchorX, anchorY, bodyW, bodyH } = metrics;
        let drawW = metrics.drawW;
        let drawH = metrics.drawH;
        let drawX = metrics.drawX;
        let drawY = metrics.drawY;
        const raster = getSpriteRaster(spriteKey, img, drawW, drawH);
        if (raster) {
          drawW = raster.drawW;
          drawH = raster.drawH;
          drawX = basket.x - drawW * anchorX;
          drawY = basket.y - drawH * anchorY;
        }

        ctx.save();
        ctx.translate(basket.x, basket.y);
        ctx.scale(1, drawFixScaleY);
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = '#21344a';
        ctx.beginPath();
        ctx.ellipse(0, bodyH * 0.52, bodyW * 0.46, bodyH * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (raster) {
          ctx.drawImage(raster.canvas, drawX - basket.x, drawY - basket.y, drawW, drawH);
        } else {
          ctx.drawImage(img, drawX - basket.x, drawY - basket.y, drawW, drawH);
        }
        ctx.restore();
      }

      function drawBasketFallback() {
        const x = basket.x;
        const y = basket.y;
        const w = basket.w;
        const h = basket.h;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, drawFixScaleY);

        ctx.globalAlpha = 0.30;
        ctx.fillStyle = '#21344a';
        ctx.beginPath();
        ctx.ellipse(0, h * 0.50, w * 0.46, h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        const shell = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
        shell.addColorStop(0, '#ffe9ba');
        shell.addColorStop(0.54, '#f2b157');
        shell.addColorStop(1, '#c98134');
        ctx.fillStyle = shell;
        roundedRect(-w/2, -h/2, w, h, 20);
        ctx.fill();

        ctx.lineWidth = Math.max(2.8, h * 0.1);
        ctx.strokeStyle = 'rgba(118,65,22,.58)';
        roundedRect(-w/2, -h/2, w, h, 20);
        ctx.stroke();

        ctx.save();
        roundedRect(-w/2 + 8, -h/2 + 8, w - 16, h - 16, 14);
        ctx.clip();

        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = '#bc6e2e';
        ctx.lineWidth = Math.max(2.4, h * 0.095);
        for (let ix = -w; ix <= w; ix += 20) {
          ctx.beginPath();
          ctx.moveTo(ix, -h);
          ctx.lineTo(ix + w, h);
          ctx.stroke();
        }

        ctx.globalAlpha = 0.28;
        for (let ix = -w; ix <= w; ix += 22) {
          ctx.beginPath();
          ctx.moveTo(ix, h);
          ctx.lineTo(ix + w, -h);
          ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = 'rgba(255,246,220,.95)';
        roundedRect(-w/2 + 8, -h/2 + 8, w - 16, h * 0.2, 10);
        ctx.fill();

        ctx.strokeStyle = '#fbe8c1';
        ctx.lineWidth = Math.max(3, h * 0.09);
        ctx.beginPath();
        ctx.arc(0, -h/2 + 6, w*0.29, Math.PI * 1.05, Math.PI * 1.95, true);
        ctx.stroke();

        ctx.strokeStyle = '#b36d33';
        ctx.lineWidth = Math.max(2, h * 0.05);
        ctx.beginPath();
        ctx.arc(0, -h/2 + 6, w*0.29, Math.PI * 1.05, Math.PI * 1.95, true);
        ctx.stroke();

        ctx.restore();
      }

      function drawObject(o) {
        if (!FEATURE_FLAGS.USE_IMAGE_SPRITES) {
          drawObjectFallback(o);
          return;
        }
        drawObjectSpriteOrFallback(o);
      }

      function drawObjectSpriteOrFallback(o) {
        const spriteKey = getSpriteKeyForObject(o);
        if (!spriteKey) {
          drawObjectFallback(o);
          return;
        }
        const img = getImageOrNull(spriteKey);
        if (!img) {
          drawObjectFallback(o);
          return;
        }

        const meta = spriteMeta[spriteKey] || {};
        const collisionRadiusPx = meta.collisionRadiusPx || Math.max(1, (img.naturalWidth || img.width) * 0.5);
        const scale = (o.r / collisionRadiusPx) * (meta.drawScale ?? 1);
        if (!Number.isFinite(scale) || scale <= 0) {
          drawObjectFallback(o);
          return;
        }

        let drawW = (img.naturalWidth || img.width) * scale;
        let drawH = (img.naturalHeight || img.height) * scale;
        const raster = getSpriteRaster(spriteKey, img, drawW, drawH);
        if (raster) {
          drawW = raster.drawW;
          drawH = raster.drawH;
        }

        const anchorX = meta.anchorX ?? 0.5;
        const anchorY = meta.anchorY ?? 0.5;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.scale(1, drawFixScaleY);
        ctx.rotate(o.rot);
        if (o.kind === 'star') {
          const glow = ctx.createRadialGradient(0, 0, o.r * 0.08, 0, 0, o.r * 1.5);
          glow.addColorStop(0, 'rgba(255,250,211,.42)');
          glow.addColorStop(0.5, 'rgba(255,223,128,.26)');
          glow.addColorStop(1, 'rgba(255,183,92,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, o.r * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (raster) {
          ctx.drawImage(raster.canvas, -drawW * anchorX, -drawH * anchorY, drawW, drawH);
        } else {
          ctx.drawImage(img, -drawW * anchorX, -drawH * anchorY, drawW, drawH);
        }
        ctx.restore();
      }

      function drawObjectFallback(o) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.scale(1, drawFixScaleY);
        ctx.rotate(o.rot);

        if (o.kind === 'star') {
          const glow = ctx.createRadialGradient(0, 0, o.r * 0.08, 0, 0, o.r * 1.45);
          glow.addColorStop(0, 'rgba(255,250,211,.9)');
          glow.addColorStop(0.38, 'rgba(255,223,128,.65)');
          glow.addColorStop(1, 'rgba(255,183,92,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, o.r * 1.45, 0, Math.PI * 2);
          ctx.fill();

          const starFill = ctx.createLinearGradient(-o.r, -o.r, o.r, o.r);
          starFill.addColorStop(0, '#fff7b6');
          starFill.addColorStop(0.56, '#ffd86a');
          starFill.addColorStop(1, '#ffb95b');
          ctx.fillStyle = starFill;
          drawStarPath(o.r, o.r * 0.5);
          ctx.fill();

          ctx.lineWidth = Math.max(1.5, o.r * 0.09);
          ctx.strokeStyle = 'rgba(255,255,255,.65)';
          ctx.stroke();

          ctx.fillStyle = 'rgba(255,255,255,.6)';
          drawStarPath(o.r * 0.42, o.r * 0.2);
          ctx.fill();

          ctx.restore();
          return;
        }

        if (o.kind === 'bug') {
          ctx.shadowColor = 'rgba(31,20,12,.32)';
          ctx.shadowBlur = Math.max(6, o.r * 0.30);
          ctx.shadowOffsetY = Math.max(2, o.r * 0.14);
          drawBug(o.r);
          ctx.restore();
          return;
        }

        const style = getFruitStyle(o.fruitKind);
        ctx.shadowColor = 'rgba(23,35,56,.28)';
        ctx.shadowBlur = Math.max(6, o.r * 0.28);
        ctx.shadowOffsetY = Math.max(2, o.r * 0.14);
        if (style.kind === 'banana') {
          drawBanana(style, o.r);
        } else if (style.kind === 'apple') {
          drawApple(style, o.r);
        } else if (style.kind === 'orange') {
          drawOrange(style, o.r);
        } else if (style.kind === 'peach') {
          drawPeach(style, o.r);
        } else if (style.kind === 'strawberry') {
          drawStrawberry(style, o.r);
        } else if (style.kind === 'grape') {
          drawGrape(style, o.r);
        } else if (style.kind === 'watermelon') {
          drawWatermelon(style, o.r);
        } else {
          drawRoundFruit(style, o.r);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        drawFruitVisibilityRing(o.r, style.base);

        ctx.restore();
      }

      function drawParticles(dt) {
        for (let i=pops.length-1;i>=0;i--){
          const p = pops[i];
          p.t += dt;
          const k = 1 - (p.t / p.life);
          if (k <= 0) { pops.splice(i,1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 980 * dt;

          const alpha = Math.max(0, k) * particleDensity;
          if (alpha <= 0.01) continue;
          const size = p.r * (0.5 + k * (0.5 + particleDensity * 0.2));

          ctx.globalAlpha = alpha * (fever ? 1.0 : 0.9);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          if ((i % 4) === 0) {
            ctx.moveTo(p.x, p.y - size);
            ctx.lineTo(p.x + size * 0.76, p.y);
            ctx.lineTo(p.x, p.y + size);
            ctx.lineTo(p.x - size * 0.76, p.y);
            ctx.closePath();
          } else {
            ctx.arc(p.x, p.y, size, 0, Math.PI*2);
          }
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      function drawFloatTexts(dt) {
        for (let i=floatTexts.length-1;i>=0;i--){
          const ft = floatTexts[i];
          ft.t += dt;
          const k = 1 - (ft.t / ft.life);
          if (k <= 0) { floatTexts.splice(i,1); continue; }
          ft.y += ft.vy * dt;

          ctx.save();
          ctx.globalAlpha = Math.max(0, k);
          ctx.translate(ft.x, ft.y);
          ctx.scale(1, drawFixScaleY);
          const fontSize = Math.max(20, Math.round(30 * floatTextScale));
          ctx.font = `${canvasBodyFontWeight} ${fontSize}px ${canvasBodyFontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.strokeStyle = 'rgba(32,48,73,.42)';
          ctx.lineWidth = Math.max(4, fontSize * 0.22);
          ctx.strokeText(ft.text, 0, 0);

          const textFill = ctx.createLinearGradient(-fontSize * 0.8, 0, fontSize * 0.8, 0);
          textFill.addColorStop(0, '#fffdf4');
          textFill.addColorStop(0.5, ft.color);
          textFill.addColorStop(1, '#fffdf4');
          ctx.fillStyle = textFill;
          ctx.fillText(ft.text, 0, 0);
          ctx.restore();
        }
      }

      function drawCriticalLifeOverlay(now) {
        if (!running || paused || gameOver) return;
        if (getLivesLeft() !== 1) return;
        const pulse = 0.5 + 0.5 * Math.sin(now * (reducedMotionQuery.matches ? 0.004 : 0.009));
        const alpha = (reducedMotionQuery.matches ? 0.05 : 0.08) + pulse * (reducedMotionQuery.matches ? 0.025 : 0.055);
        ctx.save();
        const vignette = ctx.createRadialGradient(
          canvas.width * 0.5,
          canvas.height * 0.5,
          canvas.width * 0.24,
          canvas.width * 0.5,
          canvas.height * 0.5,
          canvas.width * 0.82
        );
        vignette.addColorStop(0, 'rgba(255,96,160,0)');
        vignette.addColorStop(0.72, `rgba(255,88,150,${(alpha * 0.45).toFixed(3)})`);
        vignette.addColorStop(1, `rgba(214,26,90,${alpha.toFixed(3)})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Main loop
      let last = performance.now();
      function frame(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;

        // Clear
        ctx.clearRect(0,0,canvas.width,canvas.height);
        updateDrawFixScale();

        // Background
        drawBackground();

        if (running && !paused) {
          totalElapsed += dt;
          updateBaselineMetrics(dt);
          updateFeverEffects(dt);

          // speed multiplier (every 30 sec +10%)
          const gMul = globalSpeedMultiplier();

          // Basket movement
          const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
          const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');

          if (left) basket.vx = -basket.speed;
          else if (right) basket.vx = basket.speed;
          else basket.vx *= 0.85;

          // Mouse target easing
          if (basket.targetX != null) {
            const dx = basket.targetX - basket.x;
            basket.x += dx * (1 - Math.pow(0.000001, dt));
          } else {
            basket.x += basket.vx * dt;
          }

          basket.x = clamp(basket.x, basket.w/2 + 14, canvas.width - basket.w/2 - 14);

          // Spawn
          spawnTimer += dt;
          if (spawnTimer >= spawnInterval()) {
            spawnTimer = 0;
            spawnObject();
          }

          // Fever timer UI & end
          if (fever) {
            const remain = Math.max(0, feverEnd - totalElapsed);
            feverTimeEl.textContent = `${remain.toFixed(1)}s`;
            if (remain <= 0) {
              fever = false;
              if (music && soundOn) music.setMode('normal');
              setFeverPhase('exit', totalElapsed);
              pop(canvas.width*0.5, canvas.height*0.22, '#ffffff', 24);
            }
          }

          // Update objects
          for (let i=objects.length-1;i>=0;i--){
            const o = objects[i];

            const vy = o.vyBase * o.baseMul * gMul;

            o.y += vy * dt;
            o.rot += o.spin * dt * rotationMotionScale;

            // Catch?
            if (intersectsObjBasket(o)) {
              objects.splice(i,1);

              if (o.kind === 'star') {
                // Fever start (20s), points x2
                fever = true;
                feverEnd = Math.max(feverEnd, totalElapsed) + FEVER_DURATION;
                setFeverPhase('enter', totalElapsed, o.x, o.y);
                playMetrics.feverTriggers += 1;

                spawnImpactByEvent(o);
                addFloatText(o.x, o.y - 10, 'フィーバー！', '#ffd670');
                triggerFeverHitFeedback(o.x, o.y, '#ffd670');

                sfx('star');
                if (music && soundOn) music.setMode('fever');
                continue;
              }

              if (o.kind === 'bug') {
                misses++;
                updateHearts();
                spawnImpactByEvent(o);
                addFloatText(o.x, o.y - 10, 'ダメージ!', '#ff6688');
                sfx('miss');
                triggerLifeDamageEffect();
                if (misses >= MAX_MISSES) {
                  endGame();
                  break;
                }
                continue;
              }

              const basePts = o.points;
              const got = fever ? basePts * 2 : basePts;

              score += got;
              scoreEl.textContent = String(score);

              spawnImpactByEvent(o);
              const scoreText = fever ? `${basePts}×2 = +${got}` : `+${got}`;
              addFloatText(o.x, o.y - 12, scoreText, fever ? '#ffd670' : o.color);
              if (fever) triggerFeverHitFeedback(o.x, o.y, '#ffd670');
              sfx('catch');
              continue;
            }

            // Missed?
            if (o.y - o.r > canvas.height + 10) {
              objects.splice(i,1);

              if (o.kind === 'star' || o.kind === 'bug') continue;

              misses++;
              updateHearts();
              pop(clamp(o.x, 40, canvas.width-40), canvas.height-55, '#ff4d6d', 14);
              sfx('miss');
              triggerLifeDamageEffect();

              if (misses >= MAX_MISSES) {
                endGame();
                break;
              }
            }
          }
        }

        updateImpactFx(dt);

        // Draw objects
        for (const o of objects) drawObject(o);

        // Draw basket
        drawBasket();

        // Impact FX
        drawImpactFx();

        // Fever foreground FX
        drawFeverSparkLayer();
        drawFeverHitBurstsLayer();

        // Particles & float texts
        drawParticles(dt);
        drawFloatTexts(dt);
        drawCriticalLifeOverlay(now);

        if (damageFlash > 0.001) {
          const alpha = clamp(damageFlash, 0, 1) * (reducedMotionQuery.matches ? 0.14 : 0.2);
          ctx.save();
          ctx.fillStyle = `rgba(255,66,112,${alpha.toFixed(3)})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        }
        damageFlash = Math.max(0, damageFlash - dt * (reducedMotionQuery.matches ? 1.9 : 2.7));

        syncSharedState();
        requestAnimationFrame(frame);
      }

      // Init
      applyResponsiveProfile();
      syncCanvasBodyFontTokens();
      window.addEventListener('resize', scheduleResponsiveProfileApply, {passive:true});
      window.addEventListener('orientationchange', scheduleResponsiveProfileApply, {passive:true});
      if (typeof reducedMotionQuery.addEventListener === 'function') {
        reducedMotionQuery.addEventListener('change', scheduleResponsiveProfileApply);
      } else if (typeof reducedMotionQuery.addListener === 'function') {
        reducedMotionQuery.addListener(scheduleResponsiveProfileApply);
      }
      if (typeof coarsePointerQuery.addEventListener === 'function') {
        coarsePointerQuery.addEventListener('change', scheduleResponsiveProfileApply);
      } else if (typeof coarsePointerQuery.addListener === 'function') {
        coarsePointerQuery.addListener(scheduleResponsiveProfileApply);
      }
      updateHearts();
      resetOverlayTextToStart();
      // Preload in background; startGame/restartGame still applies timeout guard.
      void loadGameAssets();
      requestAnimationFrame(frame);

      // Start with overlay (music off until start)
      if (music) music.setEnabled(false);
      syncSharedState();
      };

      FC.bootstrap();
})();
