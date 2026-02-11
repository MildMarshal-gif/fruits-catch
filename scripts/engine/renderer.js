(() => {
  const FC = (window.FC = window.FC || {});

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function createRendererEngine({
    canvas,
    ctx,
    root = document.documentElement
  } = {}) {
    if (!canvas || !ctx) {
      throw new Error('createRendererEngine requires canvas and ctx');
    }

    const state = {
      logicalWidth: canvas.width || 1280,
      logicalHeight: canvas.height || 720,
      cssWidth: 0,
      cssHeight: 0,
      drawFixScaleY: 1,
      mode: 'balanced',
      tier: 'quality',
      renderScale: 1,
      devicePixelRatio: 1
    };

    let lastRect = null;
    let resizeObserver = null;

    function getModeScaleCap(mode, dpr) {
      if (mode === 'quality') return Math.min(dpr, 3.0);
      if (mode === 'performance') return Math.min(dpr, 1.75);
      if (mode === 'balanced') return Math.min(dpr, 2.5);
      return 0;
    }

    function getAutoScaleCap(tier, dpr) {
      if (tier === 'performance') return Math.min(dpr, 1.75);
      if (tier === 'balanced') return Math.min(dpr, 2.25);
      return Math.min(dpr, 2.5);
    }

    function computeRenderScale() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      state.devicePixelRatio = dpr;
      if (state.mode === 'auto') {
        return getAutoScaleCap(state.tier, dpr);
      }
      const fixed = getModeScaleCap(state.mode, dpr);
      return fixed > 0 ? fixed : Math.min(dpr, 2.5);
    }

    function refreshRectCache() {
      const rect = canvas.getBoundingClientRect();
      lastRect = rect;
      state.cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || state.logicalWidth));
      state.cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || state.logicalHeight));
      const sx = state.cssWidth / Math.max(1, state.logicalWidth);
      const sy = state.cssHeight / Math.max(1, state.logicalHeight);
      state.drawFixScaleY = (!sx || !sy) ? 1 : clamp(sx / sy, 0.55, 1.65);
      return rect;
    }

    function configure({
      logicalWidth,
      logicalHeight,
      mode = state.mode,
      tier = state.tier
    } = {}) {
      if (Number.isFinite(logicalWidth) && logicalWidth > 0) state.logicalWidth = logicalWidth;
      if (Number.isFinite(logicalHeight) && logicalHeight > 0) state.logicalHeight = logicalHeight;
      if (mode) state.mode = mode;
      if (tier) state.tier = tier;

      refreshRectCache();
      state.renderScale = computeRenderScale();

      // logicalWidth/logicalHeight define game world units.
      // physicalW/physicalH define backing-store pixels for high-DPI rendering.
      const physicalW = Math.max(1, Math.round(state.logicalWidth * state.renderScale));
      const physicalH = Math.max(1, Math.round(state.logicalHeight * state.renderScale));
      if (canvas.width !== physicalW) canvas.width = physicalW;
      if (canvas.height !== physicalH) canvas.height = physicalH;
      ctx.setTransform(state.renderScale, 0, 0, state.renderScale, 0, 0);
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) {
        ctx.imageSmoothingQuality = 'high';
      }

      if (root) {
        root.style.setProperty('--render-scale', state.renderScale.toFixed(3));
        root.dataset.qualityTier = state.tier;
      }

      return {
        logicalWidth: state.logicalWidth,
        logicalHeight: state.logicalHeight,
        renderScale: state.renderScale,
        devicePixelRatio: state.devicePixelRatio,
        drawFixScaleY: state.drawFixScaleY
      };
    }

    function preFrame() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(state.renderScale, 0, 0, state.renderScale, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
    }

    function createLayer(width, height) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      const supportOffscreen = typeof OffscreenCanvas !== 'undefined';
      const backingCanvas = supportOffscreen ? new OffscreenCanvas(w, h) : document.createElement('canvas');
      backingCanvas.width = w;
      backingCanvas.height = h;
      const backingCtx = backingCanvas.getContext('2d');
      if (backingCtx) {
        backingCtx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in backingCtx) backingCtx.imageSmoothingQuality = 'high';
      }
      return {
        canvas: backingCanvas,
        ctx: backingCtx
      };
    }

    function attachAutoRectObservers() {
      if (resizeObserver) return;
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(() => refreshRectCache());
        resizeObserver.observe(canvas);
      }
      window.addEventListener('resize', refreshRectCache, { passive: true });
      window.addEventListener('orientationchange', refreshRectCache, { passive: true });
      window.addEventListener('scroll', refreshRectCache, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', refreshRectCache, { passive: true });
        window.visualViewport.addEventListener('scroll', refreshRectCache, { passive: true });
      }
    }

    function destroy() {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      window.removeEventListener('resize', refreshRectCache);
      window.removeEventListener('orientationchange', refreshRectCache);
      window.removeEventListener('scroll', refreshRectCache);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', refreshRectCache);
        window.visualViewport.removeEventListener('scroll', refreshRectCache);
      }
    }

    attachAutoRectObservers();
    refreshRectCache();

    return {
      configure,
      preFrame,
      createLayer,
      refreshRectCache,
      destroy,
      getSnapshot() {
        return {
          logicalWidth: state.logicalWidth,
          logicalHeight: state.logicalHeight,
          renderScale: state.renderScale,
          devicePixelRatio: state.devicePixelRatio,
          drawFixScaleY: state.drawFixScaleY,
          cssWidth: state.cssWidth,
          cssHeight: state.cssHeight
        };
      },
      get drawFixScaleY() {
        return state.drawFixScaleY;
      },
      get renderScale() {
        return state.renderScale;
      },
      get devicePixelRatio() {
        return state.devicePixelRatio;
      },
      get logicalWidth() {
        return state.logicalWidth;
      },
      get logicalHeight() {
        return state.logicalHeight;
      },
      get mode() {
        return state.mode;
      },
      get tier() {
        return state.tier;
      }
    };
  }

  FC.createRendererEngine = createRendererEngine;
})();
