/* VHMaps — vue 3D à la demande : MapLibre GL JS + relief AWS Terrain Tiles, fond = celui de la carte (IGN…) */
(function () {
  var V = window.__vh;
  var LIB = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl";
  var DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
  var EXAG = [1, 1.5, 2.5], ex = 1;
  var box, msgEl, followBtn, exBtn, m3 = null, mk = null, watch = null, follow = true, prev = null, head = null, libP = null;

  var css = document.createElement("style");
  css.textContent = "#v3d{position:fixed;inset:0;z-index:2000;background:#9db4c0}#v3map{position:absolute;inset:0}" +
    ".v3bar{position:absolute;z-index:3;left:10px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;gap:8px}" +
    ".v3b{min-width:46px;height:46px;padding:0 12px;font:600 15px system-ui,sans-serif;background:var(--surface,#fff);color:var(--ink,#14342f);border:1px solid var(--line,#ccc);border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.25)}" +
    ".v3b[aria-pressed=true]{background:var(--ink,#14342f);color:var(--paper,#fff)}" +
    "#v3msg{position:absolute;z-index:3;left:10px;right:10px;bottom:calc(24px + env(safe-area-inset-bottom,0px));text-align:center;font:14px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none}";
  document.head.appendChild(css);

  function lib() {
    if (window.maplibregl) return Promise.resolve();
    if (libP) return libP;
    libP = new Promise(function (ok, ko) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = LIB + ".css"; document.head.appendChild(l);
      var s = document.createElement("script"); s.src = LIB + ".js"; s.onload = ok;
      s.onerror = function () { libP = null; ko(new Error("maplibre")); };
      document.head.appendChild(s);
    });
    return libP;
  }

  function line(ll, color, w) {
    if (ll.length && Array.isArray(ll[0])) ll = ll[0];
    if (ll.length < 2) return null;
    return { type: "Feature", properties: { c: color, w: w }, geometry: { type: "LineString", coordinates: ll.map(function (p) { return [p.lng, p.lat]; }) } };
  }
  function tracks() {
    var f = [];
    V.ref.eachLayer(function (l) { if (l.getLatLngs) { var x = line(l.getLatLngs(), l.options.color || "#d6336c", 6); if (x) f.push(x); } });
    var r = line(V.line.getLatLngs(), V.line.options.color || "#d6336c", 4); if (r) f.push(r);
    return { type: "FeatureCollection", features: f };
  }

  function baseSource() {
    var b = V.BASES[V.base()];
    if (!b || !b.url) b = V.BASES.ortho;          // dalle locale : on prend la photo aérienne
    return { type: "raster", tiles: [b.url], tileSize: 256, maxzoom: b.native, attribution: b.attr };
  }

  function note(t) { msgEl.textContent = t || ""; }
  function setFollow(v) { follow = v; followBtn.setAttribute("aria-pressed", v ? "true" : "false"); }

  function makeBox() {
    box = document.createElement("div"); box.id = "v3d"; box.hidden = true;
    box.innerHTML = '<div id="v3map"></div><div class="v3bar"><button class="v3b" id="v3x" aria-label="Revenir à la carte 2D">2D</button>' +
      '<button class="v3b" id="v3f" aria-pressed="true" aria-label="Suivre ma position et mon cap">◎ Suivi</button>' +
      '<button class="v3b" id="v3e" aria-label="Exagération du relief"></button></div><div id="v3msg"></div>';
    document.body.appendChild(box);
    msgEl = box.querySelector("#v3msg"); followBtn = box.querySelector("#v3f"); exBtn = box.querySelector("#v3e");
    box.querySelector("#v3x").onclick = close;
    followBtn.onclick = function () { setFollow(!follow); if (follow && prev && m3) m3.easeTo({ center: [prev.lon, prev.lat], pitch: 65 }); };
    exBtn.onclick = function () { ex = (ex + 1) % EXAG.length; exBtn.textContent = "⛰ ×" + EXAG[ex]; if (m3) m3.setTerrain({ source: "dem", exaggeration: EXAG[ex] }); };
  }

  function onFix(pos) {
    if (!m3) return;
    var c = pos.coords, p = { lat: c.latitude, lon: c.longitude };
    if (typeof c.heading === "number" && !isNaN(c.heading) && (c.speed == null || c.speed > 0.5)) head = c.heading;
    else if (prev && V.haversine(prev, p) >= 5) head = V.bearing(prev, p);
    if (!prev || V.haversine(prev, p) >= 5) prev = p;
    if (!mk) {
      var el = document.createElement("div");
      el.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 2l7 19-7-4-7 4z" fill="#1971c2" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
      mk = new maplibregl.Marker({ element: el, rotationAlignment: "map" }).setLngLat([p.lon, p.lat]).addTo(m3);
    }
    mk.setLngLat([p.lon, p.lat]);
    if (head != null) mk.setRotation(head);
    m3.getSource("trk").setData(tracks());
    note(c.accuracy > 50 ? "Signal GPS faible (±" + Math.round(c.accuracy) + " m)…" : "");
    if (follow && c.accuracy <= 50) m3.easeTo({ center: [p.lon, p.lat], bearing: head != null ? head : m3.getBearing(), pitch: 65, zoom: Math.max(m3.getZoom(), 16), duration: 900, essential: true });
  }

  function build() {
    if (!box) makeBox();
    box.hidden = false; setFollow(true); exBtn.textContent = "⛰ ×" + EXAG[ex]; note("");
    var c = V.map.getCenter(), data = tracks();
    try {
      m3 = new maplibregl.Map({
        container: "v3map", center: [c.lng, c.lat], zoom: Math.max(V.map.getZoom() - 1, 12), pitch: 60, maxPitch: 80, maxZoom: 20,
        attributionControl: { compact: true },
        style: { version: 8,
          sources: { base: baseSource(), dem: { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 15, attribution: "Relief © Tilezen / AWS Terrain Tiles" },
                     trk: { type: "geojson", data: data } },
          layers: [{ id: "base", type: "raster", source: "base" },
                   { id: "trkc", type: "line", source: "trk", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": ["+", ["get", "w"], 4] } },
                   { id: "trk", type: "line", source: "trk", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["get", "w"] } }],
          terrain: { source: "dem", exaggeration: EXAG[ex] } }
      });
    } catch (e) { m3 = null; box.hidden = true; V.say("La vue 3D nécessite WebGL.", true); return; }
    m3.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m3.on("dragstart", function () { setFollow(false); });
    if (data.features.length) {
      var b = new maplibregl.LngLatBounds();
      data.features.forEach(function (f) { f.geometry.coordinates.forEach(function (q) { b.extend(q); }); });
      m3.fitBounds(b, { padding: 70, pitch: 60, duration: 0 });
    }
    prev = null; head = null;
    if (navigator.geolocation) watch = navigator.geolocation.watchPosition(onFix, function () { note("Position indisponible : autorisez la localisation."); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    V.say("");
  }

  function close() {
    if (watch !== null) { navigator.geolocation.clearWatch(watch); watch = null; }
    if (m3) { m3.remove(); m3 = null; }
    mk = null; box.hidden = true;
  }

  window.vue3d = { open: function () {
    if (m3) return;
    V.say("Chargement de la vue 3D…");
    lib().then(build).catch(function () { V.say("Vue 3D indisponible : une connexion est nécessaire au premier chargement.", true); });
  } };
})();
