// Минимальное «браузерное» окружение для импорта модулей Focusday в Node (без DOM-рендера).
const store = new Map();
globalThis.localStorage ??= { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() };
globalThis.window ??= globalThis;
const el = () => new Proxy(function () {}, { get: (t, p) => p === Symbol.toPrimitive ? () => '' : (p === 'length' ? 0 : el()), apply: () => el() });
globalThis.document ??= { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, createElement: () => el(), body: el(), documentElement: el(), hidden: false };
globalThis.navigator ??= { userAgent: 'node' };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });
globalThis.addEventListener ??= () => {};
