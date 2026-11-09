/* Focusday · life/merge.js — сгенерировано разбиением монолита v1.2, дальше правится руками */


/* ── 8. Слияние новых коллекций при импорте/синхронизации ───────── */
export function mergeById(a = [], b = [], deleted = {}, stats) {
  const map = new Map(a.map(x => [x.id, x]));
  b.forEach(x => {
    if (!x || !x.id) return; const mine = map.get(x.id);
    if (!mine) { if ((deleted[x.id] || 0) >= (x.updatedAt || 0)) return; map.set(x.id, x); stats.lifeAdded++; }
    else if ((x.updatedAt || 0) > (mine.updatedAt || 0)) { map.set(x.id, mine.log ? { ...x, log: { ...mine.log, ...x.log } } : x); stats.lifeUpdated++; }
    else if (mine.log && x.log) {
      const log = { ...mine.log };
      Object.entries(x.log).forEach(([d, v]) => { if (!log[d]) log[d] = v; });
      map.set(x.id, { ...mine, log });
    }
  });
  map.forEach((x, id) => { if ((deleted[id] || 0) > (x.updatedAt || 0)) map.delete(id); });
  return [...map.values()];
}
export function mergeLife(out, local, inc, deleted, stats) {
  stats.lifeAdded = 0; stats.lifeUpdated = 0;
  ['habits', 'expenses', 'chamber', 'thoughts'].forEach(k => { out[k] = mergeById(local[k], inc[k], deleted, stats); });
  out.thoughts.sort((a, b) => b.at - a.at);
  const lm = local.money || {}, im = inc.money || {};
  out.money = { ...((im.updatedAt || 0) > (lm.updatedAt || 0) ? im : lm), saved: Math.max(Number(lm.saved) || 0, Number(im.saved) || 0) };
  // v1.3: цитаты — скрытые и свои объединяются (фильтры категорий остаются локальными)
  const lq = local.quotes || {}, iq = inc.quotes || {};
  if (lq.hidden || iq.hidden || lq.custom || iq.custom) {
    const custom = new Map([...(iq.custom || []), ...(lq.custom || [])].filter(x => x && x.id).map(x => [x.id, x]));
    out.quotes = { ...iq, ...lq, hidden: [...new Set([...(lq.hidden || []), ...(iq.hidden || [])])], custom: [...custom.values()], fav: [...new Set([...(lq.fav || []), ...(iq.fav || [])])] };
  }
}
