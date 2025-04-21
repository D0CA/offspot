// src/utils/debounce.js
/**
 * Debounce a function by the given delay (ms).
 */
export function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }