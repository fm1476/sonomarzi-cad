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
      // Only interpret 'item' as Adam between a radio prefix and unit number.
      .replace(/\b(\d+|one|two|three|four|five|six|seven|eight|nine)\s+item\s+(?=\d+|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b|eleven\b|twelve\b|thirteen\b|fourteen\b|fifteen\b|sixteen\b|seventeen\b|eighteen\b|nineteen\b|twenty\b|thirty\b|forty\b|fifty\b)/g, '$1 adam ')
      .replace(/[-_.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return Object.freeze({ normalize });
});
