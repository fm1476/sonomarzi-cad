/* Pure voice text normalization. Preserve historical ASR behavior. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CadVoiceText = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function normalize(text) {
    return String(text).toLowerCase()
      .replace(/\bbatallion\b/g, 'battalion')
      .replace(/[-_.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return Object.freeze({ normalize });
});
