import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export interface MapProvider {
  id: string;
  name: string;
  rating: number;
  trade: string;
  lat: number;
  lng: number;
}

// Same approach as JobLiveMap: a Leaflet page in a WebView, free
// OpenStreetMap tiles, no native map SDK or API key. Provider names come in
// as data and are written with textContent, never as HTML.
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
  .pin.sel { background: #F27511; color: #fff; }
  .pin.sel:after { border-top-color: #F27511; }
  .pin.sel .star { color: #fff; }
  .me { width: 14px; height: 14px; border-radius: 50%; background: #1f6feb; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(31,111,235,.2); }
  .leaflet-control-attribution { font-size: 8px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false }).setView([5.6037, -0.1870], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  var layer = L.layerGroup().addTo(map), meMarker = null, fitted = false, selected = null, els = {};

  function post(m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }

  window.setProviders = function (list, me) {
    layer.clearLayers(); els = {};
    var pts = [];
    list.forEach(function (p) {
      var el = document.createElement('div');
      el.className = 'pin' + (p.id === selected ? ' sel' : '');
      var star = document.createElement('span'); star.className = 'star'; star.textContent = '\\u2605';
      var label = document.createElement('span'); label.textContent = p.rating.toFixed(1);
      el.appendChild(star); el.appendChild(label);
      var icon = L.divIcon({ className: '', html: el, iconSize: [0, 0] });
      var m = L.marker([p.lat, p.lng], { icon: icon }).addTo(layer);
      m.on('click', function () { window.select(p.id); post({ type: 'select', id: p.id }); });
      els[p.id] = el; pts.push([p.lat, p.lng]);
    });
    if (me) {
      if (!meMarker) meMarker = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [14, 14] }) }).addTo(map);
      else meMarker.setLatLng([me.lat, me.lng]);
      pts.push([me.lat, me.lng]);
    }
    if (!fitted && pts.length) { map.fitBounds(pts, { padding: [48, 48], maxZoom: 14 }); fitted = true; }
  };

  window.select = function (id) {
    if (selected && els[selected]) els[selected].className = 'pin';
    selected = id;
    if (id && els[id]) els[id].className = 'pin sel';
  };
  post({ type: 'ready' });
</script>
</body>
</html>`;

/** An interactive map of providers: a rating pin per provider at their
 * neighbourhood, the person's own position, tap a pin to select it. */
export function ProvidersMap({
  providers,
  me,
  selectedId,
  onSelect,
}: {
  providers: MapProvider[];
  me: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const payload = useMemo(() => JSON.stringify(providers), [providers]);
  const mePayload = useMemo(() => JSON.stringify(me), [me]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.setProviders(${payload}, ${mePayload}); true;`);
  }, [ready, payload, mePayload]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.select(${JSON.stringify(selectedId)}); true;`);
  }, [ready, selectedId]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; id?: string };
      if (msg.type === 'ready') setReady(true);
      if (msg.type === 'select' && msg.id) onSelect(msg.id);
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
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
