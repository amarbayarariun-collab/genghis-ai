const KEY = 'msh-temujin-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { unlocked: ['camp'], lastChapter: null, flags: {}, quality: null };
    const data = JSON.parse(raw);
    return {
      unlocked: Array.isArray(data.unlocked) ? data.unlocked : ['camp'],
      lastChapter: data.lastChapter || null,
      flags: data.flags || {},
      quality: data.quality === 'low' || data.quality === 'med' || data.quality === 'high' ? data.quality : null,
    };
  } catch {
    return { unlocked: ['camp'], lastChapter: null, flags: {}, quality: null };
  }
}

export function writeSave( partial ) {
  const cur = loadSave();
  const next = { ...cur, ...partial };
  if (partial.unlocked) {
    next.unlocked = [...new Set([...(cur.unlocked || ['camp']), ...partial.unlocked])];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* ignore quota */ }
  return next;
}

export function unlockNext(chapterId, order) {
  const i = order.indexOf(chapterId);
  const nextId = order[i + 1];
  const unlocked = [chapterId];
  if (nextId) unlocked.push(nextId);
  return writeSave({ unlocked, lastChapter: chapterId });
}
