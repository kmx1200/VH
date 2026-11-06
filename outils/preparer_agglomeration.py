"""Convertit la couche des agglomérations (GeoPackage, Lambert-93) en donnees/agglomeration.json (GeoJSON WGS84 compact).

    pip install geopandas pyogrio shapely pyproj
    python outils/preparer_agglomeration.py agglomeration.gpkg donnees/agglomeration.json
"""
import json, math, sys, warnings
from pyogrio import read_dataframe
from shapely import force_2d
from shapely.geometry import mapping

warnings.filterwarnings("ignore")
src, dst = (sys.argv[1:3] + ["agglomeration.gpkg", "donnees/agglomeration.json"][len(sys.argv[1:3]):])[:2]

df = read_dataframe(src)
df = df.set_geometry(df.geometry.apply(force_2d).simplify(1, preserve_topology=True)).to_crs(4326)

def pt(c): return [round(c[0], 5), round(c[1], 5)]
def conv(g):
    m = mapping(g)
    if m["type"] == "LineString":
        return {"type": "LineString", "coordinates": [pt(c) for c in m["coordinates"]]}
    return {"type": "MultiLineString", "coordinates": [[pt(c) for c in l] for l in m["coordinates"]]}
def clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)): return None
    v = v.strip() if isinstance(v, str) else v
    return v if v != "" else None
def pr(p, a):
    p, a = clean(p), clean(a)
    return None if p is None else str(p) + "+" + str(int(a or 0))

feats = []
for _, r in df.iterrows():
    if r.geometry is None or r.geometry.is_empty: continue
    ch = clean(r["CHAUSSEE"])
    p = {"axe": clean(r["AXE"]), "agglo": clean(r["NOM_AGGLO"]), "commune": clean(r["NOM_COMMU_"]),
         "deb": pr(r["PLOD"], r["ABSD"]), "fin": pr(r["PLOF"], r["ABSF"]),
         "chaussee": None if ch in (None, "Unique") else ch}
    feats.append({"type": "Feature", "properties": {k: v for k, v in p.items() if v is not None}, "geometry": conv(r.geometry)})

with open(dst, "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
print(len(feats), "tronçons écrits dans", dst)
