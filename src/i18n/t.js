import strings from './strings.js';

export function t(key) {
  return strings[key] ?? key;
}

