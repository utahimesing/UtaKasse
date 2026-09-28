import strings from './strings.js';

export function t(key) {
  return strings[key] ?? key;
}

/** 帶變數的文案：tf('bundle.pickN', { n: 2 }) → '選 2 件' */
export function tf(key, vars = {}) {
  let out = t(key);
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
