#!/usr/bin/env python3
"""Convertit la couche de trafics (GeoPackage, Lambert-93) en donnees/trafic.json (GeoJSON WGS84 allégé).

Usage : python outils/preparer_trafic.py TraficSE2025.gpkg donnees/trafic.json
Aucune dépendance (sqlite3 + conversion Lambert-93 intégrée).
"""
import json, math, sqlite3, struct, sys

# Lambert-93 (EPSG:2154) -> RGF93 géographique (≈ WGS84), projection conique conforme 2 parallèles
A, F = 6378137.0, 1 / 298.257222101
E2 = F * (2 - F); E = math.sqrt(E2)
LAT1, LAT2, LAT0, LON0 = map(math.radians, (44, 49, 46.5, 3))
X0, Y0 = 700000.0, 6600000.0
def _m(p): return math.cos(p) / math.sqrt(1 - E2 * math.sin(p) ** 2)
def _t(p): return math.tan(math.pi / 4 - p / 2) / ((1 - E * math.sin(p)) / (1 + E * math.sin(p))) ** (E / 2)
N = (math.log(_m(LAT1)) - math.log(_m(LAT2))) / (math.log(_t(LAT1)) - math.log(_t(LAT2)))
G = _m(LAT1) / (N * _t(LAT1) ** N)
R0 = A * G * _t(LAT0) ** N
def l93_to_lonlat(x, y):
    dx, dy = x - X0, R0 - (y - Y0)
    r = math.copysign(math.hypot(dx, dy), N)
    th = math.atan2(dx / r if N > 0 else -dx / r, dy / r if N > 0 else -dy / r)
    t = (r / (A * G)) ** (1 / N)
    p = math.pi / 2 - 2 * math.atan(t)
    for _ in range(10):
        p = math.pi / 2 - 2 * math.atan(t * ((1 - E * math.sin(p)) / (1 + E * math.sin(p))) ** (E / 2))
    return math.degrees(th / N + LON0), math.degrees(p)

def wkb_lines(b):
    """Géométrie GPKG (en-tête + WKB) -> liste de lignes [(x, y), ...]."""
    flags = b[3]; env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    w = b[8 + env:]; out = []
    def read(o):
        bo = "<" if w[o] == 1 else ">"
        t = struct.unpack_from(bo + "I", w, o + 1)[0]; o += 5
        base = t % 1000; dim = 2 + (t // 1000 in (1, 3)) + (t // 1000 in (2, 3))
        if base == 2:
            n = struct.unpack_from(bo + "I", w, o)[0]; o += 4; pts = []
            for _ in range(n):
                v = struct.unpack_from(bo + "d" * dim, w, o); o += 8 * dim; pts.append((v[0], v[1]))
            out.append(pts)
        elif base in (5, 6):
            n = struct.unpack_from(bo + "I", w, o)[0]; o += 4
            for _ in range(n): o = read(o)
        return o
    read(0); return out

def dedup(pts):   # supprime les points consécutifs identiques après arrondi (≈ 1 m)
    return [q for i, q in enumerate(pts) if i == 0 or q != pts[i - 1]]

def pr(plo, absc): return "%s+%s" % (plo, absc)

def main(src, dst):
    c = sqlite3.connect(src)
    table = c.execute("select table_name from gpkg_geometry_columns").fetchone()[0]
    feats = []
    for axe, ch, plod, absd, plof, absf, annee, trafic, pl, geom in c.execute(
            'select AXE, CHAUSSEE, PLOD, ABSD, PLOF, ABSF, ANNEE, TRAFIC, PCT_PL, geom from "%s"' % table):
        lines = [dedup([[round(v, 5) for v in l93_to_lonlat(x, y)] for x, y in ln]) for ln in wkb_lines(geom)]
        lines = [l for l in lines if len(l) > 1]
        if not lines or trafic is None: continue
        p = {"axe": axe, "deb": pr(plod, absd), "fin": pr(plof, absf), "t": trafic, "pl": pl, "a": annee}
        if ch and ch != "Unique": p["ch"] = ch
        feats.append({"type": "Feature", "properties": p,
                      "geometry": {"type": "LineString", "coordinates": lines[0]} if len(lines) == 1
                      else {"type": "MultiLineString", "coordinates": lines}})
    with open(dst, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
    print("%d tronçons -> %s" % (len(feats), dst))

if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit(__doc__)
    main(*sys.argv[1:])
