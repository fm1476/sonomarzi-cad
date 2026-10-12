/* Pure viewport and GIS query helpers, independent of Leaflet and network. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CadGISQuery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function boundsEnvelope(bounds) {
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    return { xmin: sw.lng, ymin: sw.lat, xmax: ne.lng, ymax: ne.lat, spatialReference: { wkid: 4326 } };
  }
  function params(bounds, limit = 500) {
    return new URLSearchParams({
      where: '1=1',
      geometry: JSON.stringify(boundsEnvelope(bounds)),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: '4326',
      outSR: '4326',
      outFields: '*',
      returnGeometry: 'true',
      resultRecordCount: String(Math.max(1, Math.min(500, Math.trunc(limit) || 500))),
      f: 'geojson'
    });
  }
  return Object.freeze({ boundsEnvelope, params });
});
