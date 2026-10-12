/* Shared, dependency-free discipline filtering for boards and maps. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CadDiscipline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const DISCIPLINES = Object.freeze(['ALL', 'LAW', 'FIRE', 'EMS']);
  function normalize(value) {
    const normalized = String(value ?? 'ALL').trim().toUpperCase();
    return DISCIPLINES.includes(normalized) ? normalized : 'ALL';
  }
  function matches(unit, discipline) {
    const selected = normalize(discipline);
    return selected === 'ALL' || String(unit?.discipline ?? '').toUpperCase() === selected;
  }
  function filterUnits(units, discipline) {
    return (Array.isArray(units) ? units : []).filter(unit => matches(unit, discipline));
  }
  return Object.freeze({ DISCIPLINES, normalize, matches, filterUnits });
});
