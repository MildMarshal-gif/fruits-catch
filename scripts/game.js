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
        bgmDevBtn,
        sfxDevBtn,
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
          cloudScale: 1.5,
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
          cloudScale: 1.0,
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
          cloudScale: 1.0,
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
      let cloudScale = 1;
      let particleDensity = 1;
      let backgroundMotionScale = 1;
      let rotationMotionScale = 1;
      let floatTextScale = 1;
      let drawFixScaleY = 1;
      let canvasBodyFontFamily = '"FCRoundedXMplus1p", sans-serif';
      let canvasBodyFontWeight = '500';
      let qualityMode = FC.settings?.getQuality?.() || 'balanced';
      let qualityTier = qualityMode === 'performance'
        ? 'performance'
        : qualityMode === 'balanced'
          ? 'balanced'
          : 'quality';
      let currentRenderScale = 1;
      const viewportState = {
        logicalWidth: BASE_CANVAS_W,
        logicalHeight: BASE_CANVAS_H,
        renderScale: 1,
        deviceType: 'desktop'
      };
      let staticBackgroundLayer = null;
      let staticBackgroundLayerKey = '';
      let lastInputAt = null;
      let pendingTierApply = false;
      const perfEngine = typeof FC.createPerfEngine === 'function'
        ? FC.createPerfEngine({
            frameWindowSize: 120,
            inputWindowSize: 120,
            slowThresholdMs: 24,
            fastThresholdMs: 18,
            slowHoldMs: 3000,
            fastHoldMs: 8000
          })
        : null;
      if (perfEngine && typeof FC.attachPerfEngine === 'function') {
        FC.attachPerfEngine(perfEngine);
      }
      if (perfEngine) {
        perfEngine.setQualityTier(qualityTier);
      }
      const assetsEngine = typeof FC.createAssetEngine === 'function'
        ? FC.createAssetEngine({
            maxRasterCacheBytes: 48 * 1024 * 1024,
            tintAlphaCutoff: 6
          })
        : null;
      const rendererEngine = typeof FC.createRendererEngine === 'function'
        ? FC.createRendererEngine({ canvas, ctx, root })
        : null;
      let inputEngine = null;

      function getQualityTierFromMode(mode) {
        if (mode === 'performance') return 'performance';
        if (mode === 'balanced') return 'balanced';
        return 'quality';
      }

      function getActiveQualityTier() {
        return qualityMode === 'auto' ? qualityTier : getQualityTierFromMode(qualityMode);
      }

      function getGameWidth() {
        return Math.max(1, Math.round(viewportState.logicalWidth || BASE_CANVAS_W));
      }

      function getGameHeight() {
        return Math.max(1, Math.round(viewportState.logicalHeight || BASE_CANVAS_H));
      }

      function updateQualityDataAttrs() {
        root.dataset.qualityMode = qualityMode;
        root.dataset.qualityTier = getActiveQualityTier();
      }

      const detachQualityListener = FC.settings?.subscribeQuality?.((nextMode) => {
        qualityMode = nextMode;
        if (nextMode !== 'auto') {
          qualityTier = getQualityTierFromMode(nextMode);
          if (perfEngine) perfEngine.setQualityTier(qualityTier);
        }
        pendingTierApply = true;
        updateQualityDataAttrs();
        scheduleResponsiveProfileApply();
      }) || (() => {});

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
      const FEVER_BADGE_CLOUD_SCALE = 1.55;

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
      // Bump this when image assets are replaced so browsers fetch fresh files.
      const ASSET_VERSION = '2026-02-15-4';

      function withAssetVersion(path) {
        return `${path}?v=${encodeURIComponent(ASSET_VERSION)}`;
      }

      const IMAGE_MANIFEST = {
        fruit_apple: withAssetVersion('assets/images/game-objects/fruit_apple_v2.png'),
        fruit_banana: withAssetVersion('assets/images/game-objects/fruit_banana_v2.png'),
        fruit_orange: withAssetVersion('assets/images/game-objects/fruit_orange_v2.png'),
        fruit_peach: withAssetVersion('assets/images/game-objects/fruit_peach_v2.png'),
        fruit_strawberry: withAssetVersion('assets/images/game-objects/fruit_strawberry_v2.png'),
        fruit_grape: withAssetVersion('assets/images/game-objects/fruit_grape_v2.png'),
        fruit_watermelon: withAssetVersion('assets/images/game-objects/fruit_watermelon_v2.png'),
        hazard_bug: withAssetVersion('assets/images/game-objects/hazard_bug_v2.png'),
        bonus_star: withAssetVersion('assets/images/game-objects/bonus_star_v2.png'),
        basket_default: withAssetVersion('assets/images/game-objects/basket_default_v1.png'),
        fx_bug_hit: withAssetVersion('assets/images/game-effects/fx_bug_hit_v1.png'),
        fx_star_burst: withAssetVersion('assets/images/game-effects/fx_star_burst_v1.png'),
        fx_fruit_pop: withAssetVersion('assets/images/game-effects/fx_fruit_pop_v1.png'),
        meteor_star_face1: withAssetVersion('assets/images/game-effects/meteor_star_face1_v1.png'),
        meteor_star_face2: withAssetVersion('assets/images/game-effects/meteor_star_face2_v1.png'),
        meteor_star_face3: withAssetVersion('assets/images/game-effects/meteor_star_face3_v1.png'),
        background_day_sky: withAssetVersion('assets/images/backgrounds/background_day_sky_v1.png'),
        background_fever_sky: withAssetVersion('assets/images/backgrounds/background_fever_sky_v1.png'),
        background_day_sky_mobile: withAssetVersion('assets/images/backgrounds/background_day_sky_mobile_v1.png'),
        background_fever_sky_mobile: withAssetVersion('assets/images/backgrounds/background_fever_sky_mobile_v1.png'),
        cloud_01: withAssetVersion('assets/images/backgrounds/cloud_01_v1.png'),
        cloud_02: withAssetVersion('assets/images/backgrounds/cloud_02_v1.png'),
        cloud_03: withAssetVersion('assets/images/backgrounds/cloud_03_v1.png')
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
      const SHOOTING_STAR_MAX_ACTIVE = 4;

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
      inputEngine = FC.createInputEngine({
        canvas,
        getLogicalWidth: () => getGameWidth(),
        getClampRange: () => ({
          min: basket.w / 2 + 14,
          max: getGameWidth() - basket.w / 2 - 14
        }),
        onTargetX: (x, at) => {
          basket.targetX = x;
          lastInputAt = at;
        }
      });

      // Audio (SFX + BGM engine)
      const audioCtx = (() => {
        try { return new (window.AudioContext || window.webkitAudioContext)(); }
        catch { return null; }
      })();
      const SOUND_CROSSFADE_MS = 180;
      const BGM_MASTER_VOLUME = 0.1955;
      const SFX_PRESENCE_GAIN = 1.25;
      const CATCH_PRESENCE_GAIN = 1.2;
      const debugState = FC.debug || (FC.debug = {});
      if (!Object.prototype.hasOwnProperty.call(debugState, 'lastFrameError')) {
        debugState.lastFrameError = null;
      }
      let soundOn = FC.settings?.getSoundOn?.();
      if (typeof soundOn !== 'boolean') soundOn = true;
      let bgmOn = FC.settings?.getBgmOn?.();
      if (typeof bgmOn !== 'boolean') bgmOn = true;
      let sfxOn = FC.settings?.getSfxOn?.();
      if (typeof sfxOn !== 'boolean') sfxOn = true;
      const devAudioControlsEnabled = !!FC.debug?.devAudioControlsEnabled;
      const audioEngine = typeof FC.createAudioEngine === 'function'
        ? FC.createAudioEngine({
            audioContext: audioCtx,
            defaultCrossfadeMs: SOUND_CROSSFADE_MS,
            masterVolume: BGM_MASTER_VOLUME,
            logger: console
          })
        : null;

      function isBgmEnabled() {
        return !!(soundOn && bgmOn);
      }

      function isSfxEnabled() {
        return !!(soundOn && sfxOn);
      }

      async function ensureAudioContextResumed() {
        if (!audioCtx) return;
        try { await audioCtx.resume?.(); } catch {}
      }

      function safeAudioTransition(nextMode) {
        if (!audioEngine) return;
        try {
          audioEngine.setMode(nextMode, SOUND_CROSSFADE_MS);
        } catch (error) {
          console.warn('[audio] setMode transition failed', { nextMode, error });
        }
      }

      ui.wireControls({
        startBtn,
        pauseBtn,
        resumeBtn,
        pauseRestartBtn,
        soundBtn,
        bgmDevBtn,
        sfxDevBtn,
        devAudioControlsEnabled,
        onStart: () => startGame(),
        onPause: () => setPaused(true),
        onResume: () => setPaused(false),
        onRestart: () => restartGame(),
        onUiClick: () => sfx('ui'),
        isSoundOn: () => soundOn,
        isBgmOn: () => bgmOn,
        isSfxOn: () => sfxOn,
        onToggleSound: async (nextSoundOn) => {
          soundOn = !!nextSoundOn;
          FC.settings?.setSoundOn?.(soundOn);
          if (soundOn) await ensureAudioContextResumed();
          if (audioEngine) {
            audioEngine.setEnabled(isBgmEnabled());
            if (isBgmEnabled() && running && !paused && !gameOver) {
              await audioEngine.startSession(fever ? 'fever' : 'normal');
            } else if (!isBgmEnabled()) {
              audioEngine.pause();
            }
          }
          syncSharedState();
        },
        onToggleBgm: async (nextBgmOn) => {
          bgmOn = !!nextBgmOn;
          FC.settings?.setBgmOn?.(bgmOn);
          if (isBgmEnabled()) await ensureAudioContextResumed();
          if (audioEngine) {
            audioEngine.setEnabled(isBgmEnabled());
            if (isBgmEnabled() && running && !paused && !gameOver) {
              await audioEngine.startSession(fever ? 'fever' : 'normal');
            } else if (!isBgmEnabled()) {
              audioEngine.pause();
            }
          }
          syncSharedState();
        },
        onToggleSfx: async (nextSfxOn) => {
          sfxOn = !!nextSfxOn;
          FC.settings?.setSfxOn?.(sfxOn);
          syncSharedState();
        }
      });

      // DEV-BEGIN: deterministic SFX profile exploration (easy to remove as one block).
      const DEV_SFX_PROFILE_QUERY_KEY = 'sfxProfile';
      const DEV_SFX_PROFILE_DEFAULT = 'bright-pop';
      const SFX_PROFILE_PRESETS = Object.freeze({
        'bright-pop': {
          mix: {
            send: 0.28,
            wet: 0.74,
            delayA: 0.047,
            delayB: 0.081,
            feedbackA: 0.2,
            feedbackB: 0.17,
            panA: -0.32,
            panB: 0.32,
            wetLowpassHz: 4600,
            compThreshold: -24,
            compRatio: 3.3,
            lowShelfGain: 1.4,
            highShelfGain: 2.1,
            output: 0.9
          },
          events: {
            ui: {
              outGain: 0.18,
              voices: [
                { at: 0.0, freq: 3120, duration: 0.018, type: 'square', gainPeak: 0.032 },
                { at: 0.0, freq: 1980, duration: 0.05, type: 'triangle', gainPeak: 0.07, slideTo: 1640 },
                { at: 0.009, freq: 2440, duration: 0.03, type: 'sine', gainPeak: 0.028 }
              ]
            },
            catch: {
              outGain: 0.19,
              voices: [
                { at: 0.0, freq: 840, duration: 0.082, type: 'sine', gainPeak: 0.056, slideTo: 1220 },
                { at: 0.008, freq: 980, duration: 0.12, type: 'triangle', gainPeak: 0.052, slideTo: 1480 },
                { at: 0.018, freq: 1680, duration: 0.2, type: 'sine', gainPeak: 0.03, detune: -8, slideTo: 2140 },
                { at: 0.022, freq: 1680, duration: 0.22, type: 'sine', gainPeak: 0.03, detune: 8, slideTo: 2200 },
                { at: 0.034, freq: 2560, duration: 0.17, type: 'sine', gainPeak: 0.018, slideTo: 2920 }
              ]
            },
            star: {
              outGain: 0.26,
              voices: [
                { at: 0.0, freq: 880, duration: 0.115, type: 'triangle', gainPeak: 0.115 },
                { at: 0.024, freq: 1174, duration: 0.122, type: 'triangle', gainPeak: 0.12 },
                { at: 0.05, freq: 1568, duration: 0.13, type: 'triangle', gainPeak: 0.125 },
                { at: 0.076, freq: 2092, duration: 0.15, type: 'triangle', gainPeak: 0.132 },
                { at: 0.018, freq: 2350, duration: 0.11, type: 'square', gainPeak: 0.058 },
                { at: 0.12, freq: 2640, duration: 0.2, type: 'sine', gainPeak: 0.034 },
                { at: 0.138, freq: 1980, duration: 0.22, type: 'sine', gainPeak: 0.03 }
              ]
            },
            damage: {
              outGain: 0.24,
              voices: [
                { at: 0.0, freq: 310, duration: 0.115, type: 'triangle', gainPeak: 0.11, slideTo: 208 },
                { at: 0.028, freq: 246, duration: 0.12, type: 'triangle', gainPeak: 0.12, slideTo: 164 },
                { at: 0.056, freq: 192, duration: 0.126, type: 'triangle', gainPeak: 0.12, slideTo: 130 },
                { at: 0.012, freq: 152, duration: 0.19, type: 'sawtooth', gainPeak: 0.052, slideTo: 92 },
                { at: 0.064, freq: 118, duration: 0.24, type: 'sine', gainPeak: 0.043 }
              ]
            }
          }
        },
        'arcade-chip': {
          mix: {
            send: 0.14,
            wet: 0.5,
            delayA: 0.031,
            delayB: 0.055,
            feedbackA: 0.12,
            feedbackB: 0.1,
            panA: -0.25,
            panB: 0.25,
            wetLowpassHz: 3600,
            compThreshold: -20,
            compRatio: 2.8,
            lowShelfGain: 0.9,
            highShelfGain: 1.4,
            output: 0.84
          },
          events: {
            ui: {
              outGain: 0.16,
              voices: [
                { at: 0.0, freq: 2480, duration: 0.015, type: 'square', gainPeak: 0.03 },
                { at: 0.007, freq: 1860, duration: 0.03, type: 'square', gainPeak: 0.048, slideTo: 1490 }
              ]
            },
            catch: {
              outGain: 0.18,
              voices: [
                { at: 0.0, freq: 960, duration: 0.065, type: 'square', gainPeak: 0.052, slideTo: 1320 },
                { at: 0.01, freq: 1220, duration: 0.088, type: 'square', gainPeak: 0.048, slideTo: 1640 },
                { at: 0.018, freq: 1540, duration: 0.16, type: 'triangle', gainPeak: 0.036, detune: -6, slideTo: 2060 },
                { at: 0.022, freq: 1540, duration: 0.17, type: 'triangle', gainPeak: 0.036, detune: 6, slideTo: 2120 },
                { at: 0.03, freq: 2380, duration: 0.14, type: 'sine', gainPeak: 0.018, slideTo: 2820 }
              ]
            },
            star: {
              outGain: 0.25,
              voices: [
                { at: 0.0, freq: 880, duration: 0.08, type: 'square', gainPeak: 0.088 },
                { at: 0.02, freq: 1320, duration: 0.088, type: 'square', gainPeak: 0.094 },
                { at: 0.04, freq: 1760, duration: 0.096, type: 'square', gainPeak: 0.1 },
                { at: 0.06, freq: 2640, duration: 0.11, type: 'square', gainPeak: 0.106 },
                { at: 0.085, freq: 1980, duration: 0.14, type: 'triangle', gainPeak: 0.056 }
              ]
            },
            damage: {
              outGain: 0.23,
              voices: [
                { at: 0.0, freq: 270, duration: 0.1, type: 'square', gainPeak: 0.086, slideTo: 184 },
                { at: 0.024, freq: 204, duration: 0.108, type: 'square', gainPeak: 0.09, slideTo: 140 },
                { at: 0.048, freq: 154, duration: 0.115, type: 'square', gainPeak: 0.096, slideTo: 106 },
                { at: 0.0, freq: 96, duration: 0.15, type: 'triangle', gainPeak: 0.042 },
                { at: 0.06, freq: 74, duration: 0.18, type: 'sine', gainPeak: 0.038 }
              ]
            }
          }
        },
        'soft-toy': {
          mix: {
            send: 0.36,
            wet: 0.82,
            delayA: 0.063,
            delayB: 0.097,
            feedbackA: 0.24,
            feedbackB: 0.2,
            panA: -0.28,
            panB: 0.28,
            wetLowpassHz: 2900,
            compThreshold: -26,
            compRatio: 3.8,
            lowShelfGain: 2.4,
            highShelfGain: 0.7,
            output: 0.88
          },
          events: {
            ui: {
              outGain: 0.16,
              voices: [
                { at: 0.0, freq: 1620, duration: 0.028, type: 'sine', gainPeak: 0.026 },
                { at: 0.005, freq: 1240, duration: 0.052, type: 'triangle', gainPeak: 0.05, slideTo: 980 }
              ]
            },
            catch: {
              outGain: 0.18,
              voices: [
                { at: 0.0, freq: 760, duration: 0.11, type: 'sine', gainPeak: 0.05, slideTo: 1080 },
                { at: 0.012, freq: 980, duration: 0.14, type: 'triangle', gainPeak: 0.046, slideTo: 1360 },
                { at: 0.022, freq: 1460, duration: 0.24, type: 'sine', gainPeak: 0.032, detune: -7, slideTo: 1900 },
                { at: 0.026, freq: 1460, duration: 0.26, type: 'sine', gainPeak: 0.032, detune: 7, slideTo: 1960 },
                { at: 0.042, freq: 2240, duration: 0.2, type: 'sine', gainPeak: 0.02, slideTo: 2660 }
              ]
            },
            star: {
              outGain: 0.23,
              voices: [
                { at: 0.0, freq: 660, duration: 0.12, type: 'triangle', gainPeak: 0.09 },
                { at: 0.028, freq: 880, duration: 0.13, type: 'triangle', gainPeak: 0.096 },
                { at: 0.056, freq: 1174, duration: 0.145, type: 'triangle', gainPeak: 0.1 },
                { at: 0.088, freq: 1568, duration: 0.165, type: 'sine', gainPeak: 0.085 },
                { at: 0.12, freq: 1980, duration: 0.22, type: 'sine', gainPeak: 0.03 }
              ]
            },
            damage: {
              outGain: 0.22,
              voices: [
                { at: 0.0, freq: 220, duration: 0.12, type: 'triangle', gainPeak: 0.092, slideTo: 150 },
                { at: 0.03, freq: 176, duration: 0.126, type: 'triangle', gainPeak: 0.094, slideTo: 118 },
                { at: 0.06, freq: 138, duration: 0.136, type: 'triangle', gainPeak: 0.096, slideTo: 96 },
                { at: 0.012, freq: 104, duration: 0.21, type: 'sine', gainPeak: 0.038 },
                { at: 0.08, freq: 82, duration: 0.24, type: 'sine', gainPeak: 0.036 }
              ]
            }
          }
        }
      });

      function normalizeSfxProfileId(value) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, '-');
        return normalized || null;
      }

      function readDevSfxProfileIdFromQuery() {
        try {
          const url = new URL(window.location.href);
          return normalizeSfxProfileId(url.searchParams.get(DEV_SFX_PROFILE_QUERY_KEY));
        } catch {
          return null;
        }
      }

      function resolveActiveSfxProfile() {
        const requested = readDevSfxProfileIdFromQuery();
        const defaultId = normalizeSfxProfileId(DEV_SFX_PROFILE_DEFAULT) || 'bright-pop';
        const safeDefault = SFX_PROFILE_PRESETS[defaultId] ? defaultId : 'bright-pop';
        if (requested && SFX_PROFILE_PRESETS[requested]) {
          return { id: requested, preset: SFX_PROFILE_PRESETS[requested], requested };
        }
        if (requested && !SFX_PROFILE_PRESETS[requested]) {
          console.warn('[audio][dev] unknown sfxProfile; fallback to default', {
            requested,
            fallback: safeDefault
          });
        }
        return { id: safeDefault, preset: SFX_PROFILE_PRESETS[safeDefault], requested };
      }

      const activeSfxProfile = resolveActiveSfxProfile();
      debugState.activeSfxProfile = activeSfxProfile.id;
      // DEV-END: deterministic SFX profile exploration.

      // SFX bus: dry/wet blend -> compressor -> tone shaping.
      // Parameters are selected from the active deterministic SFX profile.
      const sfxMixer = (() => {
        if (!audioCtx) return null;
        try {
          const mix = activeSfxProfile?.preset?.mix || {};
          const input = audioCtx.createGain();
          const dryGain = audioCtx.createGain();
          const sendGain = audioCtx.createGain();
          const wetGain = audioCtx.createGain();
          const delayA = audioCtx.createDelay(0.5);
          const delayB = audioCtx.createDelay(0.5);
          const feedbackA = audioCtx.createGain();
          const feedbackB = audioCtx.createGain();
          const panA = audioCtx.createStereoPanner();
          const panB = audioCtx.createStereoPanner();
          const wetLowpass = audioCtx.createBiquadFilter();
          const comp = audioCtx.createDynamicsCompressor();
          const lowShelf = audioCtx.createBiquadFilter();
          const highShelf = audioCtx.createBiquadFilter();
          const output = audioCtx.createGain();

          dryGain.gain.value = clamp(Number(mix.dry) || 1.0, 0.2, 2.0);
          sendGain.gain.value = clamp(Number(mix.send) || 0.26, 0, 0.8);
          wetGain.gain.value = clamp(Number(mix.wet) || 0.7, 0, 1.2);
          delayA.delayTime.value = clamp(Number(mix.delayA) || 0.052, 0.005, 0.3);
          delayB.delayTime.value = clamp(Number(mix.delayB) || 0.089, 0.005, 0.3);
          feedbackA.gain.value = clamp(Number(mix.feedbackA) || 0.21, 0, 0.6);
          feedbackB.gain.value = clamp(Number(mix.feedbackB) || 0.19, 0, 0.6);
          panA.pan.value = clamp(Number(mix.panA) || -0.35, -1, 1);
          panB.pan.value = clamp(Number(mix.panB) || 0.35, -1, 1);
          wetLowpass.type = 'lowpass';
          wetLowpass.frequency.value = clamp(Number(mix.wetLowpassHz) || 3600, 600, 12000);
          wetLowpass.Q.value = clamp(Number(mix.wetLowpassQ) || 0.7, 0.1, 8);

          comp.threshold.value = clamp(Number(mix.compThreshold) || -24, -80, 0);
          comp.knee.value = clamp(Number(mix.compKnee) || 18, 0, 40);
          comp.ratio.value = clamp(Number(mix.compRatio) || 3.2, 1, 20);
          comp.attack.value = clamp(Number(mix.compAttack) || 0.003, 0, 1);
          comp.release.value = clamp(Number(mix.compRelease) || 0.09, 0, 1);

          lowShelf.type = 'lowshelf';
          lowShelf.frequency.value = clamp(Number(mix.lowShelfHz) || 220, 60, 1000);
          lowShelf.gain.value = clamp(Number(mix.lowShelfGain) || 1.6, -12, 12);

          highShelf.type = 'highshelf';
          highShelf.frequency.value = clamp(Number(mix.highShelfHz) || 3200, 800, 12000);
          highShelf.gain.value = clamp(Number(mix.highShelfGain) || 1.2, -12, 12);

          output.gain.value = clamp(Number(mix.output) || 0.95, 0, 1);

          input.connect(dryGain);
          input.connect(sendGain);
          dryGain.connect(comp);

          sendGain.connect(delayA);
          sendGain.connect(delayB);
          delayA.connect(feedbackA);
          feedbackA.connect(delayA);
          delayB.connect(feedbackB);
          feedbackB.connect(delayB);
          delayA.connect(panA);
          delayB.connect(panB);
          panA.connect(wetLowpass);
          panB.connect(wetLowpass);
          wetLowpass.connect(wetGain);
          wetGain.connect(comp);

          comp.connect(lowShelf);
          lowShelf.connect(highShelf);
          highShelf.connect(output);
          output.connect(audioCtx.destination);

          return { input };
        } catch (error) {
          console.warn('[audio] failed to build sfx mixer, falling back to direct output', error);
          return null;
        }
      })();

      function getSfxDestinationNode() {
        if (!audioCtx) return null;
        return sfxMixer?.input || audioCtx.destination;
      }

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
        const safeDuration = Math.max(0.012, Number(duration) || 0);
        const peak = clamp(Number(gainPeak) || 0.16, 0.001, 0.45);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.detune.setValueAtTime(detune, time);
        osc.frequency.setValueAtTime(freq, time);
        if (slideTo && slideTo > 0) {
          osc.frequency.exponentialRampToValueAtTime(slideTo, time + safeDuration * 0.88);
        }

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(peak, time + safeDuration * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + safeDuration);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + safeDuration + 0.02);
      }

      function resolveSfxEventType(type = 'catch') {
        if (type === 'miss') return 'damage';
        if (
          type === 'ui' ||
          type === 'star' ||
          type === 'damage' ||
          type === 'catch'
        ) {
          return type;
        }
        return 'catch';
      }

      function getSfxEventPreset(type = 'catch') {
        const events = activeSfxProfile?.preset?.events;
        if (!events) return null;
        return events[resolveSfxEventType(type)] || events.catch || null;
      }

      const CATCH_TARGET_DURATION_SEC = 0.4;

      function getEventSpanSec(eventPreset) {
        if (!eventPreset || !Array.isArray(eventPreset.voices)) return 0;
        let maxSpan = 0;
        for (const voice of eventPreset.voices) {
          const at = Math.max(0, Number(voice?.at) || 0);
          const duration = Math.max(0, Number(voice?.duration) || 0);
          maxSpan = Math.max(maxSpan, at + duration);
        }
        return maxSpan;
      }

      function sfx(type='catch') {
        if (!audioCtx || !isSfxEnabled()) return;
        const resolvedType = resolveSfxEventType(type);
        const destination = getSfxDestinationNode();
        if (!destination) return;
        const eventPreset = getSfxEventPreset(resolvedType);
        if (!eventPreset || !Array.isArray(eventPreset.voices) || !eventPreset.voices.length) return;
        const baseEventSpanSec = getEventSpanSec(eventPreset);
        const timeScale = (
          resolvedType === 'catch' &&
          baseEventSpanSec > 0
        )
          ? clamp(CATCH_TARGET_DURATION_SEC / baseEventSpanSec, 0.25, 8)
          : 1;
        const t0 = audioCtx.currentTime + 0.004;
        const out = audioCtx.createGain();
        const eventGainScale = resolvedType === 'catch' ? CATCH_PRESENCE_GAIN : 1;
        out.gain.value = clamp((Number(eventPreset.outGain) || 0.22) * SFX_PRESENCE_GAIN * eventGainScale, 0.01, 0.5);
        out.connect(destination);
        for (const voice of eventPreset.voices) {
          const voiceAt = Math.max(0, Number(voice.at) || 0) * timeScale;
          const voiceDuration = Math.max(0.012, (Number(voice.duration) || 0) * timeScale);
          oneShotVoice({
            time: t0 + voiceAt,
            freq: Number(voice.freq) || 0,
            duration: voiceDuration,
            destination: out,
            type: voice.type || 'triangle',
            gainPeak: Number(voice.gainPeak) || 0.1,
            detune: Number(voice.detune) || 0,
            slideTo: Number(voice.slideTo) || 0
          });
        }
      }
      debugState.playSfx = (type = 'catch') => sfx(type);

      function syncSharedState() {
        sharedState.running = running;
        sharedState.paused = paused;
        sharedState.gameOver = gameOver;
        sharedState.score = score;
        sharedState.misses = misses;
        sharedState.fever = fever;
        sharedState.feverEnd = feverEnd;
        sharedState.soundOn = soundOn;
        sharedState.bgmOn = bgmOn;
        sharedState.sfxOn = sfxOn;
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
        if (assetsEngine?.normalizeHexColor) {
          return assetsEngine.normalizeHexColor(color);
        }
        return null;
      }

      function parseHexColor(color) {
        if (assetsEngine?.parseHexColor) {
          return assetsEngine.parseHexColor(color);
        }
        return null;
      }

      function getFruitPopTintColor(fruitKind) {
        return getFruitStyle(fruitKind).base;
      }

      function getFruitPopTintSource(baseImg, tintColor) {
        if (!assetsEngine?.getFruitPopTintSource) return null;
        return assetsEngine.getFruitPopTintSource(baseImg, tintColor);
      }

      function getSpriteRaster(spriteKey, img, targetDrawW, targetDrawH) {
        if (!assetsEngine?.getSpriteRaster) return null;
        return assetsEngine.getSpriteRaster(spriteKey, img, targetDrawW, targetDrawH, currentRenderScale || window.devicePixelRatio || 1);
      }

      function updateScoreCardState() {
        ui.updateScoreCardState({
          scoreCardEl,
          scoreMulEl,
          fever,
          feverPhase: feverFx.phase
        });
      }

      // Keep score number and fever decoration in one update path.
      function syncScoreDisplay() {
        scoreEl.textContent = String(score);
        updateScoreCardState();
      }

      function applyScoreGain(o) {
        const basePts = o.points;
        const multiplier = fever ? 2 : 1;
        const got = basePts * multiplier;
        score += got;
        syncScoreDisplay();

        const scoreText = `＋${basePts}`;
        addFloatText(o.x, o.y - 12, scoreText, o.color, {
          badgeText: multiplier > 1 ? '×2' : ''
        });
        if (multiplier > 1) triggerFeverHitFeedback(o.x, o.y, '#ffd670');
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
              endR: Math.max(getGameWidth(), getGameHeight()) * (0.50 + i * 0.12),
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
          startR: Math.max(getGameWidth(), getGameHeight()) * 0.46,
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
        const cx = getGameWidth() * 0.5;
        const cy = getGameHeight() * 0.32;
        const density = getRuntimeFxDensity();
        const count = Math.max(8, Math.round((reducedMotionQuery.matches ? 12 : 22) * density));
        for (let i=0; i<count; i++) {
          const edge = i % 4;
          let x = 0;
          let y = 0;
          if (edge === 0) { x = rand(0, getGameWidth()); y = -8; }
          if (edge === 1) { x = getGameWidth() + 8; y = rand(0, getGameHeight()); }
          if (edge === 2) { x = rand(0, getGameWidth()); y = getGameHeight() + 8; }
          if (edge === 3) { x = -8; y = rand(0, getGameHeight()); }
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
        const speed = rand(155, 265) * (reducedMotionQuery.matches ? 0.64 : 1) * (0.82 + intensity * 0.25);

        const imageVariants = ['meteor_star_face1', 'meteor_star_face2', 'meteor_star_face3'];
        const imageKey = imageVariants[Math.floor(Math.random() * imageVariants.length)];

        const feverStarRadius = GRAPE_FRUIT
          ? getFruitRadiusForMul(GRAPE_FRUIT.mul)
          : clamp((fruitRadiusMin + fruitRadiusMax) * 0.44, 18, 36);
        const size = feverStarRadius * 2;
        const endScale = rand(0.40, 0.69);
        const gameW = getGameWidth();
        const gameH = getGameHeight();
        const meteorFloorY = gameH * (2 / 3);
        const startX = rand(gameW * 0.12, gameW * 0.88);
        const startY = rand(gameH * 0.12, gameH * 0.28);
        const targetX = clamp(startX + rand(-gameW * 0.05, gameW * 0.05), gameW * 0.10, gameW * 0.90);
        const minTargetY = clamp(startY + gameH * 0.24, gameH * 0.56, meteorFloorY * 0.94);
        const maxTargetY = meteorFloorY * 0.985;
        const targetY = rand(minTargetY, Math.max(minTargetY, maxTargetY));
        const dx = targetX - startX;
        const dy = targetY - startY;
        const len = Math.max(0.0001, Math.hypot(dx, dy));
        const life = Math.max(0.78, (len / speed) * rand(0.90, 1.04));
        const spinTurns = rand(0.18, 0.60);
        const spinSign = Math.random() > 0.5 ? 1 : -1;
        const rotationSpeed = ((Math.PI * 2) * spinTurns / life) * spinSign;

        shootingStars.push({
          x: startX,
          y: startY,
          vx: (dx / len) * speed,
          vy: (dy / len) * speed,
          life,
          t: 0,
          imageKey,
          size,
          endScale,
          rotation: rand(0, Math.PI * 2),
          rotationSpeed
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

      function setFeverPhase(nextPhase, nowSec, originX = getGameWidth() * 0.5, originY = getGameHeight() * 0.35) {
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
          spawnFeverShockwave(getGameWidth() * 0.5, getGameHeight() * 0.32, 'exit');
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
        const frameP95 = perfEngine ? perfEngine.getFrameP95Ms() : (dt * 1000);
        const targetQuality = frameP95 > 34
          ? 0.58
          : frameP95 > 28
            ? 0.68
            : frameP95 > 24
              ? 0.78
              : frameP95 > 18
                ? 0.90
                : 1.0;
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
          const interval = 0.75;
          while (shootingStarSpawnTimer >= interval && shootingStars.length < SHOOTING_STAR_MAX_ACTIVE) {
            shootingStarSpawnTimer -= interval * rand(0.72, 1.08);
            spawnShootingStar(state.intensity);
          }
          if (shootingStars.length >= SHOOTING_STAR_MAX_ACTIVE) {
            shootingStarSpawnTimer = Math.min(shootingStarSpawnTimer, interval * 0.15);
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
          s.rotation += s.rotationSpeed * dt;
          const lifeT = clamp(s.t / s.life, 0, 1);
          const depthScale = 1 - lifeT * (1 - s.endScale);
          const currentHalf = (s.size * depthScale) * 0.5;
          const meteorFloorY = getGameHeight() * (2 / 3);
          if (
            s.t > s.life ||
            s.y + currentHalf >= meteorFloorY ||
            s.x + s.size < -48 ||
            s.x - s.size > getGameWidth() + 48 ||
            s.y + s.size < -48 ||
            s.y - s.size > meteorFloorY + 48
          ) {
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
        const prevLogicalW = getGameWidth();
        const prevLogicalH = getGameHeight();
        const prevRenderScale = currentRenderScale;
        const canvasRect = canvas.getBoundingClientRect();
        const nextCssW = Math.max(320, Math.round(canvasRect.width || canvas.clientWidth || prevLogicalW));
        const nextCssH = Math.max(180, Math.round(canvasRect.height || canvas.clientHeight || prevLogicalH));
        const deviceType = detectDeviceType();
        const preset = DEVICE_PRESETS[deviceType];
        const activeTier = getActiveQualityTier();
        const nextLogicalW = deviceType === 'desktop' ? BASE_CANVAS_W : nextCssW;
        const nextLogicalH = deviceType === 'desktop' ? BASE_CANVAS_H : nextCssH;

        let renderSnapshot = null;
        if (rendererEngine?.configure) {
          renderSnapshot = rendererEngine.configure({
            logicalWidth: nextLogicalW,
            logicalHeight: nextLogicalH,
            mode: qualityMode,
            tier: activeTier
          });
        } else {
          canvas.width = nextLogicalW;
          canvas.height = nextLogicalH;
        }

        const resolvedLogicalW = Math.max(1, Math.round(renderSnapshot?.logicalWidth || nextLogicalW));
        const resolvedLogicalH = Math.max(1, Math.round(renderSnapshot?.logicalHeight || nextLogicalH));
        const resolvedRenderScale = Math.max(1, renderSnapshot?.renderScale || 1);
        const logicalChanged = resolvedLogicalW !== prevLogicalW || resolvedLogicalH !== prevLogicalH;
        const renderScaleChanged = Math.abs(resolvedRenderScale - prevRenderScale) > 0.0001;

        viewportState.logicalWidth = resolvedLogicalW;
        viewportState.logicalHeight = resolvedLogicalH;
        viewportState.renderScale = resolvedRenderScale;
        viewportState.deviceType = deviceType;
        currentRenderScale = resolvedRenderScale;
        if (perfEngine) perfEngine.setDprScale(currentRenderScale);
        root.style.setProperty('--render-scale', currentRenderScale.toFixed(3));
        updateQualityDataAttrs();

        if (logicalChanged) {
          const scaleX = resolvedLogicalW / Math.max(1, prevLogicalW);
          const scaleY = resolvedLogicalH / Math.max(1, prevLogicalH);
          staticBackgroundLayer = null;
          staticBackgroundLayerKey = '';
          if (assetsEngine?.clearSpriteRasterCache) assetsEngine.clearSpriteRasterCache();

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
        } else if (renderScaleChanged && assetsEngine?.clearSpriteRasterCache) {
          assetsEngine.clearSpriteRasterCache();
        }

        rendererEngine?.refreshRectCache?.();
        inputEngine?.refreshRect?.();
        drawFixScaleY = clamp(rendererEngine?.drawFixScaleY || drawFixScaleY || 1, 0.55, 1.65);

        const dprFxPenalty = dpr >= 3 ? 0.90 : dpr >= 2 ? 0.95 : 1.0;
        const reducedFxMul = reducedMotion
          ? (deviceType === 'mobile' ? 0.50 : deviceType === 'tablet' ? 0.58 : 0.64)
          : 1.0;
        const tierFxMul = activeTier === 'performance' ? 0.72 : activeTier === 'balanced' ? 0.88 : 1.0;
        const motionScale = reducedMotion ? (deviceType === 'mobile' ? 0.45 : 0.55) : 1.0;
        const hudScale = clamp(preset.hudScale * (coarsePointer ? 1.02 : 1.0), 0.78, 1.08);
        const uiScale = clamp(preset.uiScale * (coarsePointer ? 1.01 : 1.0), 0.80, 1.10);
        const fx = clamp(preset.fxDensity * dprFxPenalty * reducedFxMul * tierFxMul, 0.14, 1.00);
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
        cloudScale = preset.cloudScale;
        particleDensity = clamp(fx * (reducedMotion ? 0.65 : 0.92), 0.14, 1.06);
        const tierMotionMul = activeTier === 'performance' ? 0.72 : activeTier === 'balanced' ? 0.88 : 1.0;
        backgroundMotionScale = clamp(motionScale * (reducedMotion ? 0.88 : 1.00) * tierMotionMul, 0.26, 1.00);
        rotationMotionScale = clamp(motionScale * (reducedMotion ? 0.78 : 1.00), 0.28, 1.00);
        floatTextScale = clamp(uiScale, 0.82, 1.05);
        rebuildFeverStreams();

        const prevMinX = basket.w / 2 + 14;
        const prevMaxX = getGameWidth() - basket.w / 2 - 14;
        const prevSpan = Math.max(1, prevMaxX - prevMinX);
        const normalizedX = clamp((basket.x - prevMinX) / prevSpan, 0, 1);

        basket.w = BASE_BASKET_W * preset.basketScale;
        basket.h = BASE_BASKET_H * preset.basketScale;
        basket.y = getGameHeight() - Math.max(76, getGameHeight() * 0.125);

        const minX = basket.w / 2 + 14;
        const maxX = getGameWidth() - basket.w / 2 - 14;
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
        drawFixScaleY = clamp(rendererEngine?.drawFixScaleY || drawFixScaleY || 1, 0.55, 1.65);
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

        basket.x = getGameWidth() / 2;
        basket.y = getGameHeight() - Math.max(76, getGameHeight() * 0.125);
        basket.targetX = null;

        syncScoreDisplay();
        feverTimeEl.textContent = `${FEVER_DURATION.toFixed(1)}s`;
        updateHearts();

        pauseBtn.disabled = false;
        clearFeverVisualState();
        feverBadge.classList.remove('show');
        updateScoreCardState();
        updatePausePanel();
        resetPlayMetrics();
        perfEngine?.reset?.();

        if (audioEngine) {
          audioEngine.pause();
          safeAudioTransition('normal');
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

        if (isBgmEnabled()) await ensureAudioContextResumed();
        if (audioEngine) {
          audioEngine.setEnabled(isBgmEnabled());
          if (isBgmEnabled()) {
            await audioEngine.startSession('normal');
          }
        }
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

        if (isBgmEnabled()) await ensureAudioContextResumed();
        if (audioEngine) {
          audioEngine.setEnabled(isBgmEnabled());
          if (isBgmEnabled()) {
            await audioEngine.startSession('normal');
          }
        }
      }

      function setPaused(nextPaused) {
        if (!running || gameOver) return;
        paused = !!nextPaused;
        pauseBtn.textContent = '一時停止';
        pauseBtn.disabled = paused;
        updatePausePanel();

        if (audioEngine) {
          if (paused) {
            audioEngine.pause();
          } else if (isBgmEnabled()) {
            audioEngine.resume();
          }
        }
      }

      function togglePause() {
        if (!running || gameOver) return;
        setPaused(!paused);
      }

      function endGame() {
        const endedDuringFever = fever;
        gameOver = true;
        running = false;
        paused = false;
        pauseBtn.disabled = false;
        if (!endedDuringFever) {
          clearFeverVisualState();
          feverBadge.classList.remove('show');
        } else {
          setFeverPhase('active', totalElapsed);
          feverTimeEl.textContent = `${Math.max(0, feverEnd - totalElapsed).toFixed(1)}s`;
        }
        updatePausePanel();

        if (audioEngine) audioEngine.endGame();

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

      function addFloatText(x, y, text, color, options = null) {
        floatTexts.push({
          x, y,
          vy: -90,
          t: 0,
          life: 0.85,
          text,
          color,
          badgeText: options?.badgeText || ''
        });
      }

      function spawnImpactFx(fxKey, x, y, r, rot = 0, options = null) {
        if (!FEATURE_FLAGS.USE_IMAGE_FX) return false;
        const img = getImageOrNull(fxKey);
        if (!img) return false;
        const cap = getFxQueueLimit();
        while (impactFxQueue.length >= cap) impactFxQueue.shift();
        const baseLife = fxKey === 'fx_star_burst' ? 0.46 : fxKey === 'fx_bug_hit' ? 0.40 : 0.34;
        const baseScale = fxKey === 'fx_star_burst' ? 4.40 : fxKey === 'fx_bug_hit' ? 1.10 : 2.25;
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
          pop(o.x, o.y, '#d6505d', 34);
          pop(o.x, o.y, '#78311f', 24);
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
        // every 15 sec +15%
        const steps = Math.floor(totalElapsed / 15);
        return Math.pow(1.15, steps);
      }

      function spawnObject() {
        const starChance = fever ? STAR_CHANCE_FEVER : STAR_CHANCE_NORMAL;
        const hazardChance = fever ? HAZARD_CHANCE_FEVER : HAZARD_CHANCE_NORMAL;
        const roll = Math.random();
        const isStar = roll < starChance;
        const isHazard = !isStar && roll < (starChance + hazardChance);

        if (isStar) {
          const r = GRAPE_FRUIT ? getFruitRadiusForMul(GRAPE_FRUIT.mul) : clamp((fruitRadiusMin + fruitRadiusMax) * 0.44, 18, 36);
          const x = rand(r + 18, getGameWidth() - r - 18);
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
          const r = GRAPE_FRUIT
            ? getFruitRadiusForMul(GRAPE_FRUIT.mul)
            : clamp((fruitRadiusMin + fruitRadiusMax) * 0.42, 18, 34);
          const x = rand(r + 18, getGameWidth() - r - 18);
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
        const x = rand(r + 18, getGameWidth() - r - 18);
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

      function drawCloudBadgePath(x, y, w, h) {
        ctx.beginPath();
        ctx.moveTo(x + w * 0.20, y + h * 0.86);
        ctx.bezierCurveTo(
          x + w * 0.04, y + h * 0.92,
          x + w * 0.01, y + h * 0.66,
          x + w * 0.16, y + h * 0.56
        );
        ctx.bezierCurveTo(
          x + w * 0.05, y + h * 0.42,
          x + w * 0.11, y + h * 0.14,
          x + w * 0.32, y + h * 0.22
        );
        ctx.bezierCurveTo(
          x + w * 0.40, y + h * 0.03,
          x + w * 0.61, y + h * 0.02,
          x + w * 0.69, y + h * 0.20
        );
        ctx.bezierCurveTo(
          x + w * 0.87, y + h * 0.10,
          x + w * 1.00, y + h * 0.26,
          x + w * 0.88, y + h * 0.48
        );
        ctx.bezierCurveTo(
          x + w * 1.01, y + h * 0.62,
          x + w * 0.90, y + h * 0.91,
          x + w * 0.66, y + h * 0.84
        );
        ctx.lineTo(x + w * 0.22, y + h * 0.86);
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

        // Keep watermelon rim close to other fruits to avoid a hard white outline.
        ctx.strokeStyle = 'rgba(180,245,208,.58)';
        ctx.lineWidth = Math.max(1.4, r * 0.075);
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
        const centerX = feverFx.phase === 'enter' ? feverFx.originX : getGameWidth() * 0.5;
        const centerY = feverFx.phase === 'enter' ? feverFx.originY : getGameHeight() * 0.34;

        ctx.save();
        const warmWash = ctx.createLinearGradient(0, 0, getGameWidth(), getGameHeight());
        warmWash.addColorStop(0, 'rgba(88,136,255,.38)');
        warmWash.addColorStop(0.55, 'rgba(152,112,255,.33)');
        warmWash.addColorStop(1, 'rgba(89,232,255,.34)');
        ctx.globalAlpha = (0.10 + pulse * 0.10) * intensity;
        ctx.fillStyle = warmWash;
        ctx.fillRect(0, 0, getGameWidth(), getGameHeight());
        ctx.restore();

        ctx.save();
        const aura = ctx.createRadialGradient(
          centerX,
          centerY,
          Math.max(24, getGameWidth() * 0.03),
          centerX,
          centerY,
          getGameWidth() * 0.52
        );
        aura.addColorStop(0, 'rgba(235,246,255,0.62)');
        aura.addColorStop(0.24, 'rgba(141,213,255,0.42)');
        aura.addColorStop(0.56, 'rgba(188,140,255,0.22)');
        aura.addColorStop(1, 'rgba(103,184,255,0)');
        ctx.globalAlpha = (0.14 + pulse * 0.12) * intensity;
        ctx.fillStyle = aura;
        ctx.fillRect(0, 0, getGameWidth(), getGameHeight());
        ctx.restore();

        const streamAlpha = Math.min(0.34, (0.08 + intensity * 0.16) * (0.5 + dynamicFx * 0.5));
        if (streamAlpha > 0.01 && feverStreams.length) {
          const tones = ['#86d8ff', '#9ea7ff', '#ffd2fb'];
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let i=0; i<feverStreams.length; i++) {
            const s = feverStreams[i];
            const travel = ((now * 0.001 * (92 + s.speed * 86) * backgroundMotionScale) + s.seed * 0.73) % (getGameWidth() + s.len * 2);
            const x = travel - s.len;
            const y = getGameHeight() * s.lane + Math.sin(now * 0.0016 * s.speed + s.seed) * s.amp * (0.2 + intensity * 0.8);
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
          ctx.fillRect(0, 0, getGameWidth(), getGameHeight());
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
        const gameW = getGameWidth();
        const gameH = getGameHeight();
        const secNow = now * 0.001;
        const motionMul = reducedMotionQuery.matches ? 0.55 : 1.0;
        const viewportScale = Math.min(gameW / BASE_CANVAS_W, gameH / BASE_CANVAS_H);
        const motionScale = clamp(viewportScale, 0.72, 1.45);
        const swayX = 18 * motionScale * motionMul;
        const swayY = 12 * motionScale * motionMul;
        const xBase = [0.22, 0.50, 0.78];
        const yBase = [0.35, 0.30, 0.38];
        const widthBase = [0.17, 0.15, 0.16];
        const fallbackHeightRatio = [0.31, 0.33, 0.30];
        const alphaBase = [0.60, 0.60, 0.60];
        const phase = [0.42, 2.14, 4.08];
        const pulseAmp = 0.04;
        const driftSpeedX = 0.58 * motionMul;
        const driftSpeedY = 0.44 * motionMul;
        const pulseSpeed = 1.02 * motionMul;
        const feverMix = clamp(feverIntensity, 0, 1);
        const feverBoost = feverMix * 0.10;
        const cloudTone = 'rgb(255, 255, 255)';
        const cloudImages = [
          getImageOrNull('cloud_01'),
          getImageOrNull('cloud_02'),
          getImageOrNull('cloud_03')
        ];
        const canUseCloudSprites = cloudImages.every((img) => !!img);

        ctx.save();
        for (let i = 0; i < 3; i++) {
          const pulse = 1 + Math.sin(secNow * pulseSpeed + phase[i] * 1.17) * pulseAmp;
          const drawW = gameW * widthBase[i] * pulse * cloudScale;
          const rawX = gameW * xBase[i] + Math.sin(secNow * driftSpeedX + phase[i]) * swayX;
          const rawY = gameH * yBase[i] + Math.cos(secNow * driftSpeedY + phase[i]) * swayY;
          const alpha = feverMix > 0.001 ? 0 : alphaBase[i];

          let drawH = drawW * fallbackHeightRatio[i];
          let halfW = drawW * 0.60;
          let halfH = drawH * 0.60;

          if (canUseCloudSprites) {
            const sprite = cloudImages[i];
            const imgW = Math.max(1, sprite.naturalWidth || sprite.width || 1);
            const imgH = Math.max(1, sprite.naturalHeight || sprite.height || 1);
            drawH = drawW * (imgH / imgW);
            halfW = drawW * 0.5;
            halfH = drawH * 0.5;
          }

          const HUD_SAFE_ZONE_TOP = 120;
          const x = clamp(rawX, halfW, Math.max(halfW, gameW - halfW));
          const minY = Math.max(halfH, HUD_SAFE_ZONE_TOP + halfH);
          const maxY = Math.max(minY, gameH - halfH);
          const y = clamp(rawY, minY, maxY);
          ctx.globalAlpha = alpha;

          if (canUseCloudSprites) {
            const img = cloudImages[i];
            ctx.drawImage(img, x - drawW * 0.5, y - drawH * 0.5, drawW, drawH);
          } else {
            ctx.fillStyle = cloudTone;
            ctx.beginPath();
            ctx.ellipse(x, y, drawW * 0.46, drawH * 0.50, 0, 0, Math.PI * 2);
            ctx.ellipse(x + drawW * 0.24, y - drawH * 0.15, drawW * 0.34, drawH * 0.42, 0, 0, Math.PI * 2);
            ctx.ellipse(x - drawW * 0.24, y - drawH * 0.11, drawW * 0.30, drawH * 0.39, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
        void dynamicFx;
      }

      function drawTerrainLayer(baseY, amp, step, color, alpha, phase) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, getGameHeight());
        for (let x=0; x<=getGameWidth() + step; x+=step) {
          const y = baseY + Math.sin(x * 0.006 + phase) * amp + Math.sin(x * 0.013 + phase * 1.2) * amp * 0.42;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(getGameWidth(), getGameHeight());
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      function drawShootingStarsLayer() {
        if (!shootingStars.length) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (const s of shootingStars) {
          const lifeT = clamp(s.t / s.life, 0, 1);
          const lifeK = 1 - lifeT;
          if (lifeK <= 0) continue;

          const entry = imageCache.get(s.imageKey);
          if (!entry || entry.state !== 'ready' || !entry.img) continue;

          const depthScale = 1 - lifeT * (1 - s.endScale);
          const drawSize = Math.max(1, Math.round(s.size * depthScale));
          const raster = getSpriteRaster(s.imageKey, entry.img, drawSize, drawSize);
          const drawSource = raster ? raster.canvas : entry.img;
          const drawW = raster ? raster.drawW : drawSize;
          const drawH = raster ? raster.drawH : drawSize;
          const meteorFloorY = getGameHeight() * (2 / 3);
          if (s.y + drawH * 0.5 >= meteorFloorY) continue;

          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rotation);
          ctx.globalAlpha = lifeK * 0.92;
          ctx.drawImage(drawSource, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
          ctx.restore();
        }

        ctx.restore();
      }

      function drawNightCityBackdrop(now, dynamicFx, intensity) {
        const sky = ctx.createLinearGradient(0, 0, 0, getGameHeight());
        sky.addColorStop(0, '#2e1d71');
        sky.addColorStop(0.34, '#6331ae');
        sky.addColorStop(0.68, '#a73fbe');
        sky.addColorStop(1, '#5a73cf');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, getGameWidth(), getGameHeight());

        ctx.save();
        const aurora = ctx.createRadialGradient(
          getGameWidth() * 0.52,
          getGameHeight() * 0.08,
          12,
          getGameWidth() * 0.52,
          getGameHeight() * 0.12,
          getGameWidth() * 0.62
        );
        aurora.addColorStop(0, 'rgba(255,246,255,0.64)');
        aurora.addColorStop(0.36, 'rgba(255,149,238,0.38)');
        aurora.addColorStop(0.62, 'rgba(123,201,255,0.28)');
        aurora.addColorStop(1, 'rgba(118,171,255,0)');
        ctx.globalAlpha = 0.34 + intensity * 0.26;
        ctx.fillStyle = aurora;
        ctx.fillRect(0, 0, getGameWidth(), getGameHeight());
        ctx.restore();

        const nebulaCount = Math.max(3, Math.round((4 + intensity * 4) * dynamicFx));
        ctx.save();
        for (let i=0; i<nebulaCount; i++) {
          const x = getGameWidth() * (0.16 + (i / (nebulaCount + 1)) * 0.72);
          const y = getGameHeight() * (0.13 + (i % 2) * 0.09);
          const w = getGameWidth() * (0.22 + (i % 3) * 0.07);
          const h = getGameHeight() * (0.12 + (i % 2) * 0.05);
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
          const x = (i * 131.71 + (i % 6) * 13.8) % getGameWidth();
          const y = 12 + ((i * 69.07) % (getGameHeight() * 0.62));
          const twinkle = 0.34 + 0.66 * (0.5 + 0.5 * Math.sin(now * 0.0023 + i * 1.1));
          const r = (i % 3 ? 1.0 : 1.8) * (0.82 + intensity * 0.36);
          ctx.globalAlpha = twinkle * (0.36 + intensity * 0.38);
          ctx.fillStyle = i % 5 === 0 ? '#ffd5ff' : i % 5 === 1 ? '#ffd9aa' : i % 5 === 2 ? '#a9deff' : '#d1c2ff';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

      }

      function drawBackground() {
        const now = performance.now();
        const dynamicFx = clamp(fxDensity * runtimeFxQuality, 0.18, 1.18);
        const feverState = getFeverVisualState(totalElapsed);
        const feverIntensity = feverState.intensity;
        const nightBlend = clamp((feverIntensity - 0.08) / 0.38, 0, 1);
        const activeTier = getActiveQualityTier();
        const staticKey = `${getGameWidth()}x${getGameHeight()}:${root.dataset.device || 'desktop'}:${activeTier}`;
        const deviceType = root.dataset.device || 'desktop';
        const isMobile = deviceType === 'mobile';

        // デバイス別に画像キーを選択
        const daySkyKey = isMobile ? 'background_day_sky_mobile' : 'background_day_sky';
        const feverSkyKey = isMobile ? 'background_fever_sky_mobile' : 'background_fever_sky';

        const daySky = getImageOrNull(daySkyKey);
        const feverSky = getImageOrNull(feverSkyKey);
        const useSkyImages = !!(daySky && feverSky);

        if (useSkyImages) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
          const useFeverSky = feverState.phase !== 'idle' && feverIntensity > 0.001;
          const skyImage = useFeverSky ? feverSky : daySky;

          const isDesktop = deviceType === 'desktop';
          if (isDesktop) {
            // PC: 上部864pxを使用（元画像1536×1024の下160px切り捨て）
            ctx.drawImage(
              skyImage,
              0, 0, 1536, 864,  // ソース: 上部864pxを使用
              0, 0, getGameWidth(), getGameHeight()
            );
          } else {
            // モバイル/タブレット: 全体を引き伸ばし
            ctx.drawImage(skyImage, 0, 0, getGameWidth(), getGameHeight());
          }

          ctx.restore();
        } else {
          if (!staticBackgroundLayer || staticBackgroundLayerKey !== staticKey) {
            staticBackgroundLayer = document.createElement('canvas');
            staticBackgroundLayer.width = getGameWidth();
            staticBackgroundLayer.height = getGameHeight();
            staticBackgroundLayerKey = staticKey;
            const bgCtx = staticBackgroundLayer.getContext('2d');
            if (bgCtx) {
              bgCtx.imageSmoothingEnabled = true;
              if ('imageSmoothingQuality' in bgCtx) bgCtx.imageSmoothingQuality = 'high';

              const sky = bgCtx.createLinearGradient(0, 0, 0, getGameHeight());
              sky.addColorStop(0, '#65c0ff');
              sky.addColorStop(0.5, '#a9ecff');
              sky.addColorStop(1, '#dbffc9');
              bgCtx.fillStyle = sky;
              bgCtx.fillRect(0, 0, getGameWidth(), getGameHeight());

              const sun = bgCtx.createRadialGradient(
                getGameWidth() * 0.82,
                getGameHeight() * 0.12,
                10,
                getGameWidth() * 0.82,
                getGameHeight() * 0.12,
                getGameWidth() * 0.16
              );
              sun.addColorStop(0, 'rgba(255,255,245,0.95)');
              sun.addColorStop(0.45, 'rgba(255,240,174,0.55)');
              sun.addColorStop(1, 'rgba(255,220,131,0)');
              bgCtx.globalAlpha = 0.55;
              bgCtx.fillStyle = sun;
              bgCtx.fillRect(0, 0, getGameWidth(), getGameHeight());
              bgCtx.globalAlpha = 1;

              const terrainLayers = [
                { y: getGameHeight() * 0.72, amp: 24, step: 72, color: '#9fdfa3', alpha: 0.62, phase: 0 },
                { y: getGameHeight() * 0.82, amp: 18, step: 64, color: '#7fce7e', alpha: 0.74, phase: 1.2 },
                { y: getGameHeight() * 0.90, amp: 14, step: 56, color: '#63b95b', alpha: 0.92, phase: 2.2 }
              ];
              for (const layer of terrainLayers) {
                bgCtx.save();
                bgCtx.globalAlpha = layer.alpha;
                bgCtx.fillStyle = layer.color;
                bgCtx.beginPath();
                bgCtx.moveTo(0, getGameHeight());
                for (let x = 0; x <= getGameWidth() + layer.step; x += layer.step) {
                  const y = layer.y
                    + Math.sin(x * 0.006 + layer.phase) * layer.amp
                    + Math.sin(x * 0.013 + layer.phase * 1.2) * layer.amp * 0.42;
                  bgCtx.lineTo(x, y);
                }
                bgCtx.lineTo(getGameWidth(), getGameHeight());
                bgCtx.closePath();
                bgCtx.fill();
                bgCtx.restore();
              }
            }
          }

          if (staticBackgroundLayer) {
            ctx.drawImage(staticBackgroundLayer, 0, 0, getGameWidth(), getGameHeight());
          }
        }

        if (!useSkyImages && nightBlend > 0.001) {
          ctx.save();
          const nightBackdropAlpha = 0.40 + nightBlend * 0.60;
          ctx.globalAlpha = nightBackdropAlpha;
          drawNightCityBackdrop(now, dynamicFx, clamp(0.66 + feverIntensity * 0.44, 0, 1.2));
          ctx.restore();
        }

        drawShootingStarsLayer();
        drawParallaxCloudLayer(now, dynamicFx, feverIntensity * (1 - nightBlend * 0.45));

        if (!useSkyImages) {
          drawFeverBackdrop(now, feverState, dynamicFx);

          const tierMoteMul = activeTier === 'performance' ? 0.58 : activeTier === 'balanced' ? 0.78 : 1.0;
          const moteCount = Math.max(4, Math.round((14 + feverIntensity * 12) * dynamicFx * tierMoteMul));
          ctx.save();
          ctx.globalAlpha = (0.18 + feverIntensity * 0.12) * (0.46 + dynamicFx * 0.54);
          for (let i=0; i<moteCount; i++) {
            const speed = (0.04 + feverIntensity * 0.04) * backgroundMotionScale;
            const x = (i * 137 + (now * speed)) % getGameWidth();
            const y = 84 + (i * 49) % Math.max(180, Math.round(330 * (0.62 + dynamicFx * 0.38)));
            ctx.beginPath();
            ctx.arc(x, y, (2 + (i % 3)) * (0.75 + dynamicFx * 0.25), 0, Math.PI*2);
            ctx.fillStyle = ['#ff8eb9','#ffe18f','#8bd7ff','#b8ff9b','#ffffff'][i % 5];
            ctx.fill();
          }
          ctx.restore();

          drawFeverShockwavesLayer();
        }
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

          if (ft.badgeText) {
            const mainWidth = ctx.measureText(ft.text).width;
            const badgeFontSize = fontSize;
            ctx.font = `${canvasBodyFontWeight} ${badgeFontSize}px ${canvasBodyFontFamily}`;
            const badgePadX = Math.round(fontSize * 0.52);
            const isFeverBadge = ft.badgeText === '×2';
            const cloudScale = isFeverBadge ? FEVER_BADGE_CLOUD_SCALE : 1;
            const baseBadgeH = Math.round(fontSize * 1.02);
            const baseBadgeW = Math.round(ctx.measureText(ft.badgeText).width + badgePadX * 2);
            const badgeH = Math.round(baseBadgeH * cloudScale);
            const badgeW = Math.round(baseBadgeW * cloudScale);
            const badgeCx = mainWidth * 0.36 + baseBadgeW * 0.56;
            const badgeCy = -fontSize * 0.12;
            const badgeX = -badgeW * 0.5;
            const badgeY = -badgeH * 0.5;
            const badgeAngle = 12 * Math.PI / 180;

            ctx.save();
            ctx.translate(badgeCx, badgeCy);
            ctx.rotate(badgeAngle);

            const badgeFill = ctx.createLinearGradient(0, badgeY, 0, badgeY + badgeH);
            badgeFill.addColorStop(0, '#fffef8');
            badgeFill.addColorStop(1, '#ece9e2');
            ctx.shadowColor = 'rgba(46,53,72,.22)';
            ctx.shadowBlur = Math.max(6, fontSize * 0.22);
            ctx.shadowOffsetY = Math.max(2, fontSize * 0.08);
            ctx.fillStyle = badgeFill;
            drawCloudBadgePath(badgeX, badgeY, badgeW, badgeH);
            ctx.fill();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.strokeStyle = 'rgba(104,101,116,.72)';
            const cloudStrokeScale = 1 + (cloudScale - 1) * 0.35;
            ctx.lineWidth = Math.max(1.4, fontSize * 0.12 * cloudStrokeScale);
            drawCloudBadgePath(badgeX, badgeY, badgeW, badgeH);
            ctx.stroke();

            ctx.fillStyle = '#5b5664';
            ctx.fillText(ft.badgeText, 0, badgeFontSize * 0.02);
            ctx.restore();
          }
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
          getGameWidth() * 0.5,
          getGameHeight() * 0.5,
          getGameWidth() * 0.24,
          getGameWidth() * 0.5,
          getGameHeight() * 0.5,
          getGameWidth() * 0.82
        );
        vignette.addColorStop(0, 'rgba(255,96,160,0)');
        vignette.addColorStop(0.72, `rgba(255,88,150,${(alpha * 0.45).toFixed(3)})`);
        vignette.addColorStop(1, `rgba(214,26,90,${alpha.toFixed(3)})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, getGameWidth(), getGameHeight());
        ctx.restore();
      }

      // Main loop
      let last = performance.now();
      function frame(now) {
        let dt = 0;
        try {
          dt = Math.min(0.033, (now - last) / 1000);
          last = now;

          // Clear
          if (rendererEngine?.preFrame) rendererEngine.preFrame();
          else ctx.clearRect(0,0,getGameWidth(),getGameHeight());
          updateDrawFixScale();

          if (perfEngine) {
            const sample = perfEngine.recordFrame(dt * 1000);
            const inputAt = inputEngine?.consumeLatestInputAt?.() ?? lastInputAt;
            if (Number.isFinite(inputAt)) {
              perfEngine.recordInputLatency(inputAt, now);
              lastInputAt = null;
            }
            if (qualityMode !== 'auto') {
              const fixedTier = getQualityTierFromMode(qualityMode);
              if (perfEngine.qualityTier !== fixedTier) perfEngine.setQualityTier(fixedTier);
            }
            if (qualityMode === 'auto' && sample.tierChanged) {
              qualityTier = sample.nextTier;
              pendingTierApply = true;
              updateQualityDataAttrs();
            }
            if (pendingTierApply) {
              pendingTierApply = false;
              scheduleResponsiveProfileApply();
            }
          }

          // Background
          drawBackground();

          if (running && !paused) {
            totalElapsed += dt;
            updateBaselineMetrics(dt);
            updateFeverEffects(dt);

            // speed multiplier (every 15 sec +15%)
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

            basket.x = clamp(basket.x, basket.w/2 + 14, getGameWidth() - basket.w/2 - 14);

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
                safeAudioTransition('normal');
                setFeverPhase('exit', totalElapsed);
                pop(getGameWidth()*0.5, getGameHeight()*0.22, '#ffffff', 24);
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
                  safeAudioTransition('fever');
                  continue;
                }

                if (o.kind === 'bug') {
                  misses++;
                  updateHearts();
                  spawnImpactByEvent(o);
                  addFloatText(o.x, o.y - 10, 'ダメージ!', '#ff6688');
                  sfx('damage');
                  triggerLifeDamageEffect();
                  if (misses >= MAX_MISSES) {
                    endGame();
                    break;
                  }
                  continue;
                }

                spawnImpactByEvent(o);
                applyScoreGain(o);
                sfx('catch');
                continue;
              }

              // Missed?
              if (o.y - o.r > getGameHeight() + 10) {
                objects.splice(i,1);

                if (o.kind === 'star' || o.kind === 'bug') continue;

                misses++;
                updateHearts();
                pop(clamp(o.x, 40, getGameWidth()-40), getGameHeight()-55, '#ff4d6d', 14);
                sfx('damage');
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
            ctx.fillRect(0, 0, getGameWidth(), getGameHeight());
            ctx.restore();
          }
          damageFlash = Math.max(0, damageFlash - dt * (reducedMotionQuery.matches ? 1.9 : 2.7));

          syncSharedState();
        } catch (error) {
          const message = error?.message || String(error);
          debugState.lastFrameError = {
            message,
            timeMs: Math.round(now),
            running,
            paused,
            gameOver,
            fever,
            feverPhase: feverFx.phase
          };
          console.warn('[frame] recovered from runtime error', { message, error });
          try {
            syncSharedState();
          } catch {}
        } finally {
          requestAnimationFrame(frame);
        }
      }

      // Init
      function shouldResumeBgmOnForeground() {
        return running && !paused && !gameOver && isBgmEnabled();
      }

      function performForegroundBgmRecovery() {
        if (!audioEngine) return;
        if (!shouldResumeBgmOnForeground()) return;
        audioEngine.pause();
        audioEngine.resume();
      }

      function handleVisibilityChange() {
        if (!audioEngine) return;
        if (document.hidden) {
          audioEngine.pause();
          return;
        }
        performForegroundBgmRecovery();
      }

      function handlePageHide() {
        if (!audioEngine) return;
        audioEngine.pause();
      }

      function handlePageShow() {
        performForegroundBgmRecovery();
      }

      updateQualityDataAttrs();
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
      if (audioEngine) {
        audioEngine.setEnabled(isBgmEnabled());
        void audioEngine.prime();
      }
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('pageshow', handlePageShow);
      requestAnimationFrame(frame);

      window.addEventListener('beforeunload', () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('pageshow', handlePageShow);
        detachQualityListener();
        inputEngine?.destroy?.();
        rendererEngine?.destroy?.();
        audioEngine?.dispose?.();
      });

      syncSharedState();
      };

      FC.bootstrap();
})();
