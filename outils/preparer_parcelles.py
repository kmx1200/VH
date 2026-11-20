#!/usr/bin/env python3
"""Prépare la couche « Parcelles publiques » de VHMaps à partir de parcellePubliqueSe.gpkg (Lambert-93).

Usage :  python outils/preparer_parcelles.py parcellePubliqueSe.gpkg
Sortie : donnees/parcelles/index.json  (une ligne par commune : INSEE, emprise WGS84, nombre de parcelles)
         donnees/parcelles/<INSEE>.json (GeoJSON compact d'une commune, chargé à la demande par l'appli)
Dépendances : pip install pyproj shapely
"""
import json, os, sqlite3, struct, sys
from collections import defaultdict
from pyproj import Transformer
from shapely import wkb
from shapely.geometry import mapping

SRC = sys.argv[1] if len(sys.argv) > 1 else "parcellePubliqueSe.gpkg"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "donnees", "parcelles")
SIMPLIFIER_M = 0.25      # tolérance de simplification en mètres (invisible à l'écran)
DECIMALES = 6            # ≈ 0,1 m

# Catégories de la légende « Cadastre parcelles mission publique » (QGIS) : [clé, libellé, couleur]
CATEGORIES = [
    ("COMMUNE", "Commune", "#fdbf6f"),
    ("DEPARTEMENT", "Département", "#af51ea"),
    ("ETAT", "Etat", "#915315"),
    ("OFFICE HLM", "Office HLM", "#69f5d8"),
    ("REGION", "Région", "#4539b6"),
    ("MISSION", "Mission publique", "#83992a"),   # tout le reste : établissements publics, EPCI, SNCF, SAFER, syndicats…
]
CAT_DE = {k: i for i, (k, _, _) in enumerate(CATEGORIES)}


def categorie(genre):
    return CAT_DE.get((genre or "").strip().upper(), CAT_DE["MISSION"])


def geom_wkb(blob):
    """Géométrie GeoPackage → octets WKB (saute l'en-tête GPKG)."""
    flags = blob[3]
    env = (flags >> 1) & 7
    taille = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    return blob[8 + taille:]


def main():
    tr = Transformer.from_crs(2154, 4326, always_xy=True)
    c = sqlite3.connect(SRC)
    par_commune = defaultdict(list)
    for insee, sec, num, surf, genre, nom, geom in c.execute(
        "SELECT CODE_INSEE, SECTION, PARCELLE, SURFACE, PROP_GENRE, PROP_NOM, geom FROM extrait_localisation"
    ):
        g = wkb.loads(geom_wkb(geom))
        if g.is_empty:
            continue
        g = g.simplify(SIMPLIFIER_M, preserve_topology=True)
        polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
        coords = []
        for p in polys:
            m = mapping(p)["coordinates"]
            coords.append([[[round(x, DECIMALES), round(y, DECIMALES)] for x, y in zip(*tr.transform(*zip(*ring)))] for ring in m])
        label = (sec or "").strip() + " " + (num or "").strip().lstrip("0")
        props = {"c": categorie(genre), "p": label.strip(), "s": int(surf) if surf else 0, "n": (nom or "").strip()}
        geometry = {"type": "Polygon", "coordinates": coords[0]} if len(coords) == 1 else {"type": "MultiPolygon", "coordinates": coords}
        par_commune[insee].append({"type": "Feature", "properties": props, "geometry": geometry})

    os.makedirs(OUT, exist_ok=True)
    index = []
    for insee, feats in sorted(par_commune.items()):
        xs, ys = [], []

        def parcourir(a):
            if isinstance(a[0], (int, float)):
                xs.append(a[0]); ys.append(a[1])
            else:
                for b in a: parcourir(b)
        for f in feats: parcourir(f["geometry"]["coordinates"])
        with open(os.path.join(OUT, insee + ".json"), "w", encoding="utf-8") as fh:
            json.dump({"type": "FeatureCollection", "features": feats}, fh, ensure_ascii=False, separators=(",", ":"))
        index.append({"i": insee, "b": [min(ys), min(xs), max(ys), max(xs)], "n": len(feats)})
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as fh:
        json.dump({"cat": [[l, col] for _, l, col in CATEGORIES], "communes": index}, fh, ensure_ascii=False, separators=(",", ":"))
    tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(len(index), "communes,", sum(i["n"] for i in index), "parcelles,", round(tot / 1e6, 1), "Mo")


if __name__ == "__main__":
    main()
