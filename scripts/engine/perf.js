(() => {
  const FC = (window.FC = window.FC || {});

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function percentileFromSorted(sorted, p) {
    if (!sorted.length) return 0;
    const idx = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
    return sorted[idx];
  }

  function createRollingWindow(limit) {
    const values = [];
    return {
      push(v) {
        values.push(v);
        if (values.length > limit) values.shift();
      },
      snapshot() {
        return values.slice();
      },
      clear() {
        values.length = 0;
      }
    };
  }

  function createPerfEngine(options = {}) {
    const frameWindowSize = Number.isFinite(options.frameWindowSize) ? options.frameWindowSize : 120;
    const inputWindowSize = Number.isFinite(options.inputWindowSize) ? options.inputWindowSize : 120;
    const slowThresholdMs = Number.isFinite(options.slowThresholdMs) ? options.slowThresholdMs : 24;
    const fastThresholdMs = Number.isFinite(options.fastThresholdMs) ? options.fastThresholdMs : 18;
    const slowHoldMs = Number.isFinite(options.slowHoldMs) ? options.slowHoldMs : 3000;
    const fastHoldMs = Number.isFinite(options.fastHoldMs) ? options.fastHoldMs : 8000;
    const perfNow = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? () => performance.now()
      : () => Date.now();

    const frameTimes = createRollingWindow(frameWindowSize);
    const fpsValues = createRollingWindow(frameWindowSize);
    const inputLatencies = createRollingWindow(inputWindowSize);

    let consecutiveSlowMs = 0;
    let consecutiveFastMs = 0;
    let qualityTier = 'quality';
    let dprScale = 1;

    function sorted(values) {
      return values.sort((a, b) => a - b);
    }

    function recordFrame(frameMs) {
      if (!Number.isFinite(frameMs) || frameMs <= 0) return { tierChanged: false, nextTier: qualityTier };
      frameTimes.push(frameMs);
      fpsValues.push(1000 / frameMs);

      if (frameMs > slowThresholdMs) {
        consecutiveSlowMs += frameMs;
      } else {
        consecutiveSlowMs = Math.max(0, consecutiveSlowMs - frameMs * 0.5);
      }

      if (frameMs < fastThresholdMs) {
        consecutiveFastMs += frameMs;
      } else {
        consecutiveFastMs = Math.max(0, consecutiveFastMs - frameMs * 0.5);
      }

      let nextTier = qualityTier;
      if (consecutiveSlowMs >= slowHoldMs) {
        nextTier = qualityTier === 'quality' ? 'balanced' : qualityTier === 'balanced' ? 'performance' : 'performance';
        consecutiveSlowMs = 0;
        consecutiveFastMs = 0;
      } else if (consecutiveFastMs >= fastHoldMs) {
        nextTier = qualityTier === 'performance' ? 'balanced' : qualityTier === 'balanced' ? 'quality' : 'quality';
        consecutiveSlowMs = 0;
        consecutiveFastMs = 0;
      }

      const tierChanged = nextTier !== qualityTier;
      qualityTier = nextTier;
      return { tierChanged, nextTier };
    }

    function recordInputLatency(inputStartedAt, frameNow = perfNow()) {
      if (!Number.isFinite(inputStartedAt)) return;
      const latency = frameNow - inputStartedAt;
      if (Number.isFinite(latency) && latency >= 0) inputLatencies.push(latency);
    }

    function setQualityTier(nextTier) {
      if (nextTier === 'quality' || nextTier === 'balanced' || nextTier === 'performance') {
        qualityTier = nextTier;
        consecutiveSlowMs = 0;
        consecutiveFastMs = 0;
      }
    }

    function setDprScale(scale) {
      if (Number.isFinite(scale) && scale > 0) dprScale = scale;
    }

    function getSnapshot() {
      const frame = sorted(frameTimes.snapshot());
      const fps = sorted(fpsValues.snapshot());
      const input = sorted(inputLatencies.snapshot());
      const fpsAvg = fps.length ? fps.reduce((sum, value) => sum + value, 0) / fps.length : 0;
      return {
        fpsAvg: Number(fpsAvg.toFixed(2)),
        fpsP1: Number(percentileFromSorted(fps, 0.01).toFixed(2)),
        frameP95Ms: Number(percentileFromSorted(frame, 0.95).toFixed(2)),
        inputLatencyP95Ms: Number(percentileFromSorted(input, 0.95).toFixed(2)),
        dprScale: Number(dprScale.toFixed(3)),
        qualityTier
      };
    }

    function getFrameP95Ms() {
      const values = sorted(frameTimes.snapshot());
      return percentileFromSorted(values, 0.95);
    }

    function reset() {
      frameTimes.clear();
      fpsValues.clear();
      inputLatencies.clear();
      consecutiveSlowMs = 0;
      consecutiveFastMs = 0;
    }

    return {
      recordFrame,
      recordInputLatency,
      setQualityTier,
      setDprScale,
      getSnapshot,
      getFrameP95Ms,
      reset,
      get qualityTier() {
        return qualityTier;
      }
    };
  }

  FC.createPerfEngine = createPerfEngine;
})();
