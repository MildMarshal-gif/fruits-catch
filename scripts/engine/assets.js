(() => {
  const FC = (window.FC = window.FC || {});

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
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

  function createAssetEngine({
    maxRasterCacheBytes = 48 * 1024 * 1024,
    tintAlphaCutoff = 6
  } = {}) {
    const spriteRasterCache = new Map();
    let spriteRasterCacheBytes = 0;
    const fruitPopTintSourceCache = new Map();

    function estimateCanvasBytes(width, height) {
      return Math.max(1, width) * Math.max(1, height) * 4;
    }

    function deleteRasterEntry(cacheKey) {
      const entry = spriteRasterCache.get(cacheKey);
      if (!entry) return;
      spriteRasterCache.delete(cacheKey);
      spriteRasterCacheBytes = Math.max(0, spriteRasterCacheBytes - (entry.bytes || 0));
    }

    function touchRasterEntry(cacheKey, entry) {
      spriteRasterCache.delete(cacheKey);
      spriteRasterCache.set(cacheKey, entry);
    }

    function evictRasterToFit(extraBytes = 0) {
      const maxBytes = Math.max(4 * 1024 * 1024, maxRasterCacheBytes);
      while ((spriteRasterCacheBytes + extraBytes) > maxBytes && spriteRasterCache.size > 0) {
        const oldestKey = spriteRasterCache.keys().next().value;
        if (oldestKey == null) break;
        deleteRasterEntry(oldestKey);
      }
    }

    function getSpriteRaster(spriteKey, img, targetDrawW, targetDrawH, dpr = window.devicePixelRatio || 1) {
      if (!img || !targetDrawW || !targetDrawH) return null;
      const safeDpr = Math.max(1, Math.round(Math.max(1, dpr) * 100) / 100);
      const sizeBucket = Math.max(4, Math.round(Math.max(targetDrawW, targetDrawH) / 4) * 4);
      const cacheKey = `${spriteKey}:${sizeBucket}:${safeDpr}`;
      const cached = spriteRasterCache.get(cacheKey);
      if (cached) {
        touchRasterEntry(cacheKey, cached);
        return cached;
      }

      const srcW = Math.max(1, img.naturalWidth || img.width || 0);
      const srcH = Math.max(1, img.naturalHeight || img.height || 0);
      const maxNatural = Math.max(srcW, srcH);
      const scale = sizeBucket / maxNatural;
      const drawW = Math.max(1, Math.round(srcW * scale));
      const drawH = Math.max(1, Math.round(srcH * scale));
      const rasterW = Math.max(1, Math.round(drawW * safeDpr));
      const rasterH = Math.max(1, Math.round(drawH * safeDpr));
      const bytes = estimateCanvasBytes(rasterW, rasterH);

      evictRasterToFit(bytes);

      const offscreen = document.createElement('canvas');
      offscreen.width = rasterW;
      offscreen.height = rasterH;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return null;
      offCtx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in offCtx) offCtx.imageSmoothingQuality = 'high';
      offCtx.drawImage(img, 0, 0, rasterW, rasterH);

      const entry = {
        canvas: offscreen,
        drawW: rasterW / safeDpr,
        drawH: rasterH / safeDpr,
        bytes
      };
      spriteRasterCache.set(cacheKey, entry);
      spriteRasterCacheBytes += bytes;
      return entry;
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
      if ('imageSmoothingQuality' in offCtx) offCtx.imageSmoothingQuality = 'high';
      offCtx.drawImage(baseImg, 0, 0, srcW, srcH);

      try {
        const imageData = offCtx.getImageData(0, 0, srcW, srcH);
        const pixels = imageData.data;
        for (let i = 0; i < pixels.length; i += 4) {
          const alpha = pixels[i + 3];
          if (alpha <= tintAlphaCutoff) {
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
        offCtx.globalCompositeOperation = 'source-in';
        offCtx.fillStyle = tint.key;
        offCtx.fillRect(0, 0, srcW, srcH);
        offCtx.globalCompositeOperation = 'source-over';
      }

      fruitPopTintSourceCache.set(tint.key, offscreen);
      return offscreen;
    }

    function clearSpriteRasterCache() {
      spriteRasterCache.clear();
      spriteRasterCacheBytes = 0;
    }

    function getStats() {
      return {
        rasterEntries: spriteRasterCache.size,
        rasterBytes: spriteRasterCacheBytes,
        tintEntries: fruitPopTintSourceCache.size,
        maxRasterCacheBytes: clamp(maxRasterCacheBytes, 4 * 1024 * 1024, Number.MAX_SAFE_INTEGER)
      };
    }

    return {
      getSpriteRaster,
      getFruitPopTintSource,
      normalizeHexColor,
      parseHexColor,
      clearSpriteRasterCache,
      getStats
    };
  }

  FC.createAssetEngine = createAssetEngine;
})();
