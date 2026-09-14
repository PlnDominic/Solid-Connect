import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { radii } from '../theme';

type LatLng = { lat: number; lng: number };

// A self-contained Leaflet page loaded from CDN inside the WebView - this
// app deliberately has no native map SDK (see openInMaps/JobTrackingCard's
// own comment), but an embedded web map needs neither a native module nor
// an API key: OpenStreetMap's tile server is free, and Leaflet's own touch
// handling gives real pan/pinch-zoom for free once the page loads.
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #1c1c1c; }
  .other-pin { width: 16px; height: 16px; border-radius: 50%; background: #F27511; border: 2px solid #fff; box-shadow: 0 0 0 5px rgba(242,117,17,0.32); }
  .my-pin { width: 12px; height: 12px; border-radius: 50%; background: #15181A; border: 2px solid #fff; }
  .leaflet-control-attribution { font-size: 8px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false }).setView([5.6037, -0.1870], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var otherIcon = L.divIcon({ className: '', html: '<div class="other-pin"></div>', iconSize: [16, 16] });
  var myIcon = L.divIcon({ className: '', html: '<div class="my-pin"></div>', iconSize: [12, 12] });
  var otherMarker = null, myMarker = null, line = null, centered = false;

  window.updateTracking = function (otherLat, otherLng, myLat, myLng, fallbackLat, fallbackLng) {
    var points = [];
    if (otherLat != null && otherLng != null) {
      var op = [otherLat, otherLng];
      if (!otherMarker) otherMarker = L.marker(op, { icon: otherIcon }).addTo(map);
      else otherMarker.setLatLng(op);
      points.push(op);
    }
    if (myLat != null && myLng != null) {
      var mp = [myLat, myLng];
      if (!myMarker) myMarker = L.marker(mp, { icon: myIcon }).addTo(map);
      else myMarker.setLatLng(mp);
      points.push(mp);
    }
    if (points.length === 2) {
      if (!line) line = L.polyline(points, { color: '#F27511', weight: 2, dashArray: '4,7' }).addTo(map);
      else line.setLatLngs(points);
    }
    if (!centered) {
      if (points.length === 2) { map.fitBounds(points, { padding: [32, 32] }); centered = true; }
      else if (points.length === 1) { map.setView(points[0], 15); centered = true; }
      else if (fallbackLat != null && fallbackLng != null) { map.setView([fallbackLat, fallbackLng], 14); centered = true; }
    }
  };
</script>
</body>
</html>`;

/** The interactive live-tracking map inside JobTrackingCard - real
 * pan/pinch-zoom, markers moved in place (via injectJavaScript) rather
 * than reloading the page, so panning/zoom the person just did survives
 * the next location update. */
export function JobLiveMap({
  otherPoint,
  myPoint,
  fallbackCenter,
  height = 190,
}: {
  otherPoint: LatLng | null;
  myPoint: LatLng | null;
  fallbackCenter: LatLng | null;
  height?: number;
}) {
  const webRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);

  const updateCall = useMemo(() => {
    const arg = (v: number | null | undefined) => (v == null ? 'null' : v);
    return `window.updateTracking(${arg(otherPoint?.lat)}, ${arg(otherPoint?.lng)}, ${arg(myPoint?.lat)}, ${arg(myPoint?.lng)}, ${arg(fallbackCenter?.lat)}, ${arg(fallbackCenter?.lng)}); true;`;
  }, [otherPoint?.lat, otherPoint?.lng, myPoint?.lat, myPoint?.lng, fallbackCenter?.lat, fallbackCenter?.lng]);

  useEffect(() => {
    if (loaded) webRef.current?.injectJavaScript(updateCall);
  }, [loaded, updateCall]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        source={{ html: MAP_HTML }}
        originWhitelist={['*']}
        onLoadEnd={() => setLoaded(true)}
        scrollEnabled={false}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radii.xl, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
