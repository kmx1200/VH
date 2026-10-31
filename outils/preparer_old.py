"""Convertit la couche OLD (GeoPackage, Lambert-93) en donnees/old.json (GeoJSON WGS84 compact).

    pip install geopandas pyogrio shapely pyproj
    python outils/preparer_old.py old.gpkg donnees/old.json
"""
import json, math, sys, warnings
from pyogrio import read_dataframe
from shapely import force_2d
from shapely.geometry import mapping

warnings.filterwarnings("ignore")
src, dst = (sys.argv[1:3] + ["old.gpkg", "donnees/old.json"][len(sys.argv[1:3]):])[:2]

df = read_dataframe(src)
df = df.set_geometry(df.geometry.apply(force_2d).simplify(0.3, preserve_topology=True)).to_crs(4326)

def pt(c): return [round(c[0], 5), round(c[1], 5)]
def conv(g):
    m = mapping(g)
    if m["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [[pt(c) for c in r] for r in m["coordinates"]]}
    return {"type": "MultiPolygon", "coordinates": [[[pt(c) for c in r] for r in poly] for poly in m["coordinates"]]}
def clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)): return None
    v = v.strip() if isinstance(v, str) else v
    return v if v != "" else None
def num(v): return int(v or 0)

feats = []
for _, r in df.iterrows():
    p = {"id": clean(r["identifiant"]), "axe": clean(r["axe"]), "site": clean(r["nom_sites"]),
         "surf": None if r["surf_calculee"] != r["surf_calculee"] else int(round(r["surf_calculee"])),
         "se": num(r["super_epareuse"]), "sebl": num(r["super_epareuse_bras_long"]), "man": num(r["manuel"]),
         "mane": num(r["manuel_evacuation"]), "nold": num(r["zone_non_old"]),
         "contr": clean(r["contrainte"]), "obs": clean(r["observations"]), "bois": clean(r["bois"]), "just": clean(r["justification"])}
    feats.append({"type": "Feature", "properties": {k: v for k, v in p.items() if v is not None}, "geometry": conv(r.geometry)})

with open(dst, "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
print(len(feats), "zones écrites dans", dst)
