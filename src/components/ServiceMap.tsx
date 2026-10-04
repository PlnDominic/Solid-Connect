import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { MapBounds } from '../lib/mapPins';

/** One marker on the map.
 * - provider: a rating pill ("★ 4.8"), plus a tick when verified; a live
 *   ("Available now") provider gets a green dot and an orange ring
 * - request: a dark pill with a short label (usually the budget)
 * - live: the pulsing beacon JobLiveMap uses for a moving person, with a
 *   caption underneath (e.g. "Your pro") */
export type MapPin =
  | { kind: 'provider'; id: string; lat: number; lng: number; rating: number; verified: boolean; live?: boolean }
  | { kind: 'request'; id: string; lat: number; lng: number; label: string }
  | { kind: 'live'; id: string; lat: number; lng: number; label: string };

export type ServiceMapHandle = {
  /** Pans to a point, keeping the current zoom unless one is given. */
  centerOn: (point: { lat: number; lng: number }, zoom?: number) => void;
};

// Same approach as JobLiveMap: a Leaflet page in a WebView with free
// OpenStreetMap tiles, so no native map SDK or API key. Every label comes
// in as data and is written with textContent, never as HTML.
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #eceae6; font-family: -apple-system, Roboto, sans-serif; }
  .pin { display: flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: 999px; background: #fff;
         box-shadow: 0 2px 8px rgba(0,0,0,.18); font-size: 12px; font-weight: 700; color: #15181A; white-space: nowrap;
         transform: translate(-50%, -100%); position: absolute; }
  .pin:after { content: ''; position: absolute; left: 50%; bottom: -5px; margin-left: -5px; border: 5px solid transparent;
               border-top-color: #fff; border-bottom: 0; }
  .pin .star { color: #F27511; }
  .pin .tick { color: #0E6B45; font-size: 11px; }
  .pin.now { box-shadow: 0 0 0 2px #F27511, 0 2px 8px rgba(0,0,0,.18); }
  .pin .nowdot { width: 7px; height: 7px; border-radius: 50%; background: #0E6B45; }
  .pin.sel .nowdot { background: #fff; }
  .pin.req { background: #15181A; color: #fff; }
  .pin.req:after { border-top-color: #15181A; }
  .pin.sel { background: #F27511; color: #fff; z-index: 1000; }
  .pin.sel:after { border-top-color: #F27511; }
  .pin.sel .star, .pin.sel .tick { color: #fff; }
  .live { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; }
  .live .ring { position: relative; width: 40px; height: 40px; }
  .live .pulse { position: absolute; top: 50%; left: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px;
                 border-radius: 50%; background: rgba(242,117,17,0.55); animation: pulseRing 1.8s cubic-bezier(0.4,0,0.6,1) infinite; }
  .live .dot { position: absolute; top: 50%; left: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px;
               border-radius: 50%; background: #F27511; border: 2px solid #fff; }
  .live .cap { margin-top: -6px; padding: 2px 7px; border-radius: 999px; background: #15181A; color: #fff;
               font-size: 11px; font-weight: 700; white-space: nowrap; }
  @keyframes pulseRing { 0% { transform: scale(1); opacity: 0.65; } 100% { transform: scale(2.6); opacity: 0; } }
  .me { width: 14px; height: 14px; border-radius: 50%; background: #1f6feb; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(31,111,235,.2); }
  .leaflet-control-attribution { font-size: 8px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false }).setView([5.6037, -0.1870], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  var layer = L.layerGroup().addTo(map), meMarker = null, centered = false, selected = null, els = {}, classes = {};

  function post(m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function postBounds() {
    var b = map.getBounds();
    post({ type: 'bounds', minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() });
  }
  function span(cls, text) { var s = document.createElement('span'); if (cls) s.className = cls; s.textContent = text; return s; }

  function buildPin(p) {
    var el = document.createElement('div');
    if (p.kind === 'live') {
      el.className = 'live';
      var ring = document.createElement('div'); ring.className = 'ring';
      var pulse = document.createElement('div'); pulse.className = 'pulse';
      var dot = document.createElement('div'); dot.className = 'dot';
      ring.appendChild(pulse); ring.appendChild(dot);
      el.appendChild(ring);
      el.appendChild(span('cap', p.label));
      return el;
    }
    if (p.kind === 'provider') {
      if (p.live) el.appendChild(span('nowdot', ''));
      el.appendChild(span('star', '\\u2605'));
      el.appendChild(span('', Number(p.rating || 0).toFixed(1)));
      if (p.verified) el.appendChild(span('tick', '\\u2713'));
      classes[p.id] = p.live ? 'pin now' : 'pin';
    } else {
      el.appendChild(span('', p.label));
      classes[p.id] = 'pin req';
    }
    el.className = classes[p.id] + (p.id === selected ? ' sel' : '');
    return el;
  }

  window.setPins = function (list) {
    layer.clearLayers(); els = {}; classes = {};
    list.forEach(function (p) {
      var el = buildPin(p);
      var icon = L.divIcon({ className: '', html: el, iconSize: [0, 0] });
      var m = L.marker([p.lat, p.lng], { icon: icon, zIndexOffset: p.kind === 'live' ? 500 : 0 }).addTo(layer);
      m.on('click', function (e) { L.DomEvent.stopPropagation(e); window.select(p.id); post({ type: 'select', id: p.id }); });
      els[p.id] = el;
    });
  };

  window.setMe = function (me) {
    if (!me) return;
    if (!meMarker) meMarker = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [14, 14] }), interactive: false }).addTo(map);
    else meMarker.setLatLng([me.lat, me.lng]);
    if (!centered) { centered = true; map.setView([me.lat, me.lng], 14); }
  };

  window.centerOn = function (lat, lng, zoom) {
    centered = true;
    map.setView([lat, lng], zoom || map.getZoom());
  };

  window.select = function (id) {
    if (selected && els[selected] && classes[selected]) els[selected].className = classes[selected];
    selected = id;
    if (id && els[id] && classes[id]) els[id].className = classes[id] + ' sel';
  };

  map.on('click', function () { window.select(null); post({ type: 'select', id: null }); });
  map.on('moveend', postBounds);
  post({ type: 'ready' });
  postBounds();
</script>
</body>
</html>`;

/** The full-screen map behind the Map tab. Markers are replaced in place
 * via injectJavaScript, so a refresh never resets the person's pan/zoom. */
export const ServiceMap = forwardRef<
  ServiceMapHandle,
  {
    pins: MapPin[];
    me: { lat: number; lng: number } | null;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onBoundsChange: (bounds: MapBounds) => void;
  }
>(function ServiceMap({ pins, me, selectedId, onSelect, onBoundsChange }, ref) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const pinsPayload = useMemo(() => JSON.stringify(pins), [pins]);
  const mePayload = useMemo(() => JSON.stringify(me), [me]);

  useImperativeHandle(ref, () => ({
    centerOn: (point, zoom) => {
      webRef.current?.injectJavaScript(
        `window.centerOn(${Number(point.lat)}, ${Number(point.lng)}, ${zoom == null ? 'null' : Number(zoom)}); true;`,
      );
    },
  }));

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.setPins(${pinsPayload}); window.select(${JSON.stringify(selectedId)}); true;`);
    // selectedId is applied by its own effect; re-applying it here keeps the
    // highlight after the pins are rebuilt.
  }, [ready, pinsPayload]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.setMe(${mePayload}); true;`);
  }, [ready, mePayload]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.select(${JSON.stringify(selectedId)}); true;`);
  }, [ready, selectedId]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as {
        type: string;
        id?: string | null;
        minLat?: number;
        minLng?: number;
        maxLat?: number;
        maxLng?: number;
      };
      if (msg.type === 'ready') setReady(true);
      if (msg.type === 'select') onSelect(msg.id ?? null);
      if (
        msg.type === 'bounds' &&
        typeof msg.minLat === 'number' &&
        typeof msg.minLng === 'number' &&
        typeof msg.maxLat === 'number' &&
        typeof msg.maxLng === 'number'
      ) {
        onBoundsChange({ minLat: msg.minLat, minLng: msg.minLng, maxLat: msg.maxLat, maxLng: msg.maxLng });
      }
    } catch {
      // Ignore anything that isn't ours.
    }
  }

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        source={{ html: MAP_HTML }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
        style={styles.web}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
