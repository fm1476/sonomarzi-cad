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
      // Browser and hosted ASR often hear the law-enforcement phonetic Adam as Atom.
      .replace(/\b(?:atom|addam)\b/g, 'adam')
      .replace(/[-_.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return Object.freeze({ normalize });
});
