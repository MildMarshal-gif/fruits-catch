(() => {
  const FC = (window.FC = window.FC || {});

  const canvas = document.getElementById('game');

  FC.dom = {
    canvas,
    ctx: canvas ? canvas.getContext('2d') : null,
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

  FC._bootstrapped = false;
  FC.bootstrap = () => {
    if (FC._bootstrapped) return;
    FC._bootstrapped = true;
    if (typeof FC.initGame === 'function') {
      FC.initGame();
    }
  };
})();
