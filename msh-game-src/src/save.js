const KEY = 'msh-temujin-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { unlocked: ['camp'], lastChapter: null, flags: {}, quality: null };
    const data = JSON.parse(raw);
    // An old save must not reopen the end panel. Title is the boot screen.
    delete data.showEnd;
    delete data.screen;
    const resume = data.resume;
    const resumeOk = resume && typeof resume.x === 'number' && typeof resume.z === 'number' && typeof resume.scene === 'string';
    return {
      unlocked: Array.isArray(data.unlocked) ? data.unlocked : ['camp'],
      lastChapter: data.lastChapter || null,
      flags: data.flags || {},
      quality: data.quality === 'low' || data.quality === 'med' || data.quality === 'high' ? data.quality : null,
      tutorialDone: !!data.tutorialDone,
      resume: resumeOk ? {
        scene: resume.scene,
        x: resume.x,
        z: resume.z,
        yaw: typeof resume.yaw === 'number' ? resume.yaw : 0,
        mounted: !!resume.mounted,
      } : null,
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
