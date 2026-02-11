(() => {
  const FC = (window.FC = window.FC || {});

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function createInputEngine({
    canvas,
    getLogicalWidth,
    getClampRange,
    onTargetX
  } = {}) {
    if (!canvas) {
      throw new Error('createInputEngine requires canvas');
    }

    const perfNow = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? () => performance.now()
      : () => Date.now();

    const rectCache = {
      left: 0,
      width: 1,
      top: 0,
      height: 1
    };

    let resizeObserver = null;
    let latestInputAt = null;

    function refreshRect() {
      const rect = canvas.getBoundingClientRect();
      rectCache.left = rect.left;
      rectCache.top = rect.top;
      rectCache.width = Math.max(1, rect.width || canvas.clientWidth || 1);
      rectCache.height = Math.max(1, rect.height || canvas.clientHeight || 1);
    }

    function mapClientXToLogical(clientX) {
      const logicalWidth = Math.max(1, Number(getLogicalWidth?.()) || canvas.width || rectCache.width);
      const normalized = (clientX - rectCache.left) / rectCache.width;
      return normalized * logicalWidth;
    }

    function emitTarget(clientX) {
      if (!rectCache.width || rectCache.width <= 1) refreshRect();
      const mapped = mapClientXToLogical(clientX);
      const range = getClampRange?.() || { min: 0, max: Number(getLogicalWidth?.()) || mapped };
      const clamped = clamp(mapped, range.min, range.max);
      latestInputAt = perfNow();
      if (typeof onTargetX === 'function') onTargetX(clamped, latestInputAt);
    }

    function onPointerDown(e) {
      if (!e.isPrimary && e.pointerType !== 'mouse') return;
      refreshRect();
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch {}
      }
      emitTarget(e.clientX);
    }

    function onPointerMove(e) {
      if (!e.isPrimary && e.pointerType !== 'mouse') return;
      emitTarget(e.clientX);
    }

    function onPointerUp(e) {
      if (canvas.releasePointerCapture) {
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
      }
    }

    function attachRectObservers() {
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(() => refreshRect());
        resizeObserver.observe(canvas);
      }
      window.addEventListener('resize', refreshRect, { passive: true });
      window.addEventListener('orientationchange', refreshRect, { passive: true });
      window.addEventListener('scroll', refreshRect, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', refreshRect, { passive: true });
        window.visualViewport.addEventListener('scroll', refreshRect, { passive: true });
      }
    }

    function attachPointerEvents() {
      canvas.style.touchAction = 'none';
      canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
      canvas.addEventListener('pointermove', onPointerMove, { passive: true });
      canvas.addEventListener('pointerup', onPointerUp, { passive: true });
      canvas.addEventListener('pointercancel', onPointerUp, { passive: true });
    }

    function destroy() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', refreshRect);
      window.removeEventListener('orientationchange', refreshRect);
      window.removeEventListener('scroll', refreshRect);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', refreshRect);
        window.visualViewport.removeEventListener('scroll', refreshRect);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    }

    function consumeLatestInputAt() {
      const value = latestInputAt;
      latestInputAt = null;
      return value;
    }

    refreshRect();
    attachRectObservers();
    attachPointerEvents();

    return {
      refreshRect,
      consumeLatestInputAt,
      destroy
    };
  }

  FC.createInputEngine = createInputEngine;
})();
