/** First-minute control card. It leaves after every action, or after 60 seconds. */
const STEPS = [
  { id: 'move', text: 'Яв · W A S D, эсвэл жолоо' },
  { id: 'mount', text: 'Морь · F, эсвэл Морь' },
  { id: 'gallop', text: 'Давхи · Shift дарж барь' },
  { id: 'shoot', text: 'Нум · Q, эсвэл Нум' },
  { id: 'talk', text: 'Ярь · E, эсвэл Ярих' },
];

export function createCoach(root) {
  let left = 60;
  let active = false;
  let finished = false;
  const done = new Set();

  function paint() {
    if (!root) return;
    root.replaceChildren();
    for (const step of STEPS) {
      const line = document.createElement('div');
      line.textContent = done.has(step.id) ? `✓ ${step.text}` : step.text;
      root.append(line);
    }
    root.classList.remove('hidden');
  }

  function finish() {
    active = false;
    finished = true;
    root?.classList.add('hidden');
    return true;
  }

  return {
    start() {
      if (finished || active) return;
      active = true;
      left = 60;
      paint();
    },
    note(id) {
      if (!active || done.has(id) || !STEPS.some((s) => s.id === id)) return false;
      done.add(id);
      if (done.size >= STEPS.length) return finish();
      paint();
      return false;
    },
    update(dt) {
      if (!active) return false;
      left -= dt || 0;
      if (left > 0) return false;
      return finish();
    },
    hide() { root?.classList.add('hidden'); },
    get text() { return active ? STEPS.map((s) => s.text).join(' · ') : ''; },
    get step() { return done.size; },
    get active() { return active; },
    get finished() { return finished; },
  };
}
