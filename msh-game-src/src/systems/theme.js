/** Looping theme. The file stays unloaded until after first paint. */
const MUTE_KEY = 'msh-theme-mute';
const THEME_URL = './assets/audio/theme.mp3';

export function createTheme() {
  let audio = null;
  let started = false;
  let failed = false;
  let ducked = false;
  let muted = false;
  let raf = 0;
  let level = 0;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }

  function element() {
    if (audio) return audio;
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = 0;
    audio.addEventListener('error', () => {
      failed = true;
      level = 0;
      audio.volume = 0;
    });
    return audio;
  }

  function attachSource() {
    const node = element();
    if (!node.src) {
      node.src = THEME_URL;
      node.preload = 'auto';
    }
    return node;
  }

  const target = () => (failed || muted ? 0 : (ducked ? 0.35 : 0.6));

  function fade() {
    const node = element();
    const from = level;
    const startedAt = performance.now();
    cancelAnimationFrame(raf);
    const tick = () => {
      const goal = target();
      const t = Math.min(1, (performance.now() - startedAt) / 800);
      level = from + (goal - from) * t;
      node.volume = level;
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        level = goal;
        node.volume = goal;
      }
    };
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (failed) return;
    const node = attachSource();
    const play = node.play();
    if (play && typeof play.catch === 'function') {
      play.catch(() => {
        failed = true;
        audio.volume = 0;
      });
    }
    started = true;
    fade();
  }

  return {
    /** Start the download only after the title has painted. */
    warm() {
      if (failed) return;
      try {
        const node = attachSource();
        node.load();
      } catch (err) {
        failed = true;
        console.warn('[theme]', err);
      }
    },
    start() {
      try { start(); } catch (err) {
        failed = true;
        console.warn('[theme]', err);
      }
    },
    duck(on) {
      ducked = !!on;
      if (started) fade();
    },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
      if (started) fade();
      return muted;
    },
    get muted() { return muted; },
    get missing() { return failed; },
    get playing() { return !!(audio && !audio.paused && !audio.ended && !failed); },
    get volume() { return Math.round(level * 100) / 100; },
    get loop() { return !!audio?.loop; },
  };
}
