(() => {
  const FC = (window.FC = window.FC || {});
  const START_LOGO_SRC = './assets/images/ui/logo/fruit-catch-start-logo_v1.png';

  function getLivesLeft(maxMisses, misses) {
    return Math.max(0, maxMisses - misses);
  }

  function updateScoreCardState({ scoreCardEl, scoreMulEl, fever, feverPhase }) {
    const hot = fever || feverPhase !== 'idle';
    scoreCardEl.classList.toggle('is-fever', hot);
    scoreMulEl.classList.toggle('show', fever);
    scoreMulEl.setAttribute('aria-hidden', fever ? 'false' : 'true');
  }

  function updatePausePanel({ pausePanel, running, paused, gameOver }) {
    const show = running && paused && !gameOver;
    pausePanel.classList.toggle('show', show);
    pausePanel.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function applyLifeStateClasses({ wrapEl, heartsEl, maxMisses, misses }) {
    const livesLeft = getLivesLeft(maxMisses, misses);
    const caution = livesLeft === 2;
    const critical = livesLeft === 1;
    wrapEl.classList.toggle('life-caution', caution);
    wrapEl.classList.toggle('life-critical', critical);
    heartsEl.classList.toggle('life-critical', critical);
  }

  function triggerLifeDamageEffect({
    wrapEl,
    heartsEl,
    maxMisses,
    misses,
    damageFlash,
    lifeFxTimeout,
    clamp,
    onLifeFxTimeoutClear
  }) {
    const livesLeft = getLivesLeft(maxMisses, misses);
    const stage = livesLeft <= 1 ? 3 : livesLeft === 2 ? 2 : 1;
    const flashGain = stage === 3 ? 0.96 : stage === 2 ? 0.72 : 0.48;
    const animMs = stage === 3 ? 560 : stage === 2 ? 430 : 320;
    const nextDamageFlash = clamp(damageFlash + flashGain, 0, 1.35);

    wrapEl.classList.remove('damage-1', 'damage-2', 'damage-3');
    heartsEl.classList.remove('hit');
    void wrapEl.offsetWidth;
    wrapEl.classList.add(`damage-${stage}`);
    heartsEl.classList.add('hit');

    if (lifeFxTimeout) clearTimeout(lifeFxTimeout);
    const nextLifeFxTimeout = setTimeout(() => {
      wrapEl.classList.remove('damage-1', 'damage-2', 'damage-3');
      heartsEl.classList.remove('hit');
      if (typeof onLifeFxTimeoutClear === 'function') onLifeFxTimeoutClear();
    }, animMs);

    return {
      damageFlash: nextDamageFlash,
      lifeFxTimeout: nextLifeFxTimeout
    };
  }

  function updateScorePulseStyles({
    scoreEl,
    scoreMulEl,
    fever,
    feverPhase,
    scorePulse,
    reducedMotion,
    onUpdateScoreCardState
  }) {
    const hot = fever || feverPhase !== 'idle';
    onUpdateScoreCardState();

    if (scorePulse <= 0.001) {
      scoreEl.style.transform = 'scale(1)';
      scoreEl.style.textShadow = '';
      scoreEl.style.color = '';
      scoreEl.style.filter = '';
      scoreMulEl.style.transform = 'translateY(0) scale(1)';
      scoreMulEl.style.filter = '';
      return;
    }

    const pulseGain = reducedMotion ? 0.62 : 1.0;
    const scale = 1 + scorePulse * (hot ? 0.22 : 0.12) * pulseGain;
    const glow = Math.round((hot ? 10 : 6) + scorePulse * (hot ? 16 : 10) * pulseGain);
    scoreEl.style.transform = `scale(${scale.toFixed(3)})`;
    scoreEl.style.textShadow = hot
      ? `0 0 ${glow}px rgba(185,255,244,.9), 0 0 ${Math.round(glow * 1.45)}px rgba(104,233,255,.54), 0 0 ${Math.round(glow * 2)}px rgba(146,161,255,.44)`
      : `0 0 ${glow}px rgba(255,255,255,.45)`;
    scoreEl.style.color = hot ? '#7de2ff' : '';
    scoreEl.style.filter = hot ? `drop-shadow(0 0 ${Math.round(glow * 0.7)}px rgba(255,174,210,.42))` : '';

    const mulScale = 1 + scorePulse * (hot ? 0.14 : 0.05) * pulseGain;
    scoreMulEl.style.transform = `translateY(${-Math.round(scorePulse * (hot ? 3 : 1))}px) scale(${mulScale.toFixed(3)})`;
    scoreMulEl.style.filter = hot ? `drop-shadow(0 0 ${Math.round(glow * 0.6)}px rgba(255,255,255,.6))` : '';
  }

  function updateHearts({ heartsEl, maxMisses, misses, onApplyLifeStateClasses }) {
    heartsEl.innerHTML = '';
    for (let i = 0; i < maxMisses; i++) {
      const heart = document.createElement('span');
      const alive = i < (maxMisses - misses);
      heart.setAttribute('class', `life-heart ${alive ? 'on' : 'off'}`);
      heart.textContent = '♥';
      heart.setAttribute('aria-hidden', 'true');
      heartsEl.appendChild(heart);
    }
    heartsEl.setAttribute('aria-label', `ライフ ${Math.max(0, maxMisses - misses)} / ${maxMisses}`);
    onApplyLifeStateClasses();
  }

  function showStartLogoTitle(titleEl) {
    if (!titleEl) return;
    titleEl.textContent = '';
    titleEl.setAttribute('data-title-role', 'brand');

    const logoImg = document.createElement('img');
    logoImg.className = 'start-logo';
    logoImg.alt = 'ゲームロゴ';
    logoImg.decoding = 'async';
    logoImg.loading = 'eager';

    logoImg.src = START_LOGO_SRC;

    titleEl.append(logoImg);
  }

  function resetOverlayTextToStart({ overlay, startBtn }) {
    const titleEl = overlay.querySelector('.title');
    showStartLogoTitle(titleEl);
    overlay.querySelector('.subtitle').textContent = 'スマホでサッと遊べるキャッチゲーム！';
    overlay.querySelector('.how').innerHTML =
      `画面を左右になぞってカゴを移動<br/>
       指1本でOK（片手プレイ向け）<br/>
       3回ミスでゲームオーバー<br/>
       星を取るとフィーバーで得点2倍`;
    startBtn.textContent = 'スタート！';
  }

  function showGameOverOverlay({ overlay, startBtn, score }) {
    const titleEl = overlay.querySelector('.title');
    if (titleEl) {
      titleEl.textContent = 'ゲームオーバー';
      titleEl.setAttribute('data-title-role', 'sub');
    }
    overlay.querySelector('.subtitle').textContent = `スコア: ${score}`;
    overlay.querySelector('.how').innerHTML = 'おつかれさま！<br/>もう一度遊ぶ？';
    startBtn.textContent = 'もう一回';
    overlay.classList.add('show');
  }

  function wireControls({
    startBtn,
    pauseBtn,
    resumeBtn,
    pauseRestartBtn,
    soundBtn,
    onStart,
    onPause,
    onResume,
    onRestart,
    isSoundOn,
    onToggleSound
  }) {
    startBtn.addEventListener('click', () => onStart());
    pauseBtn.addEventListener('click', () => onPause());
    resumeBtn.addEventListener('click', () => onResume());
    pauseRestartBtn.addEventListener('click', () => onRestart());

    const renderSoundLabel = () => {
      soundBtn.textContent = `サウンド: ${isSoundOn() ? 'オン' : 'オフ'}`;
    };

    renderSoundLabel();
    soundBtn.addEventListener('click', async () => {
      const nextSoundOn = !isSoundOn();
      await onToggleSound(nextSoundOn);
      renderSoundLabel();
    });
  }

  FC.ui = {
    wireControls,
    updateScoreCardState,
    updatePausePanel,
    applyLifeStateClasses,
    triggerLifeDamageEffect,
    updateScorePulseStyles,
    updateHearts,
    resetOverlayTextToStart,
    showGameOverOverlay
  };
})();
