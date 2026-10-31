# VHMaps

Appli web (PWA) de suivi GPS : itinéraire de référence, tracé réel, direction (cap), export GPX.
Fonctionne hors ligne une fois installée (fonds de carte déjà consultés mis en cache).

## Structure

```
index.html
manifest.json
sw.js                 ← service worker (hors ligne)
itineraires.json      ← liste de repli (facultative)
itineraires/          ← déposer ici les fichiers .gpx
donnees/              ← dalle (fond de plan), référentiel routier, PR
outils/               ← script de préparation des données (non publié obligatoirement)
icons/
.nojekyll
```

## Publier sur GitHub Pages

1. Envoyer tout le contenu de ce dossier à la racine d'un dépôt public.
2. Settings → Pages → « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Ouvrir `https://PSEUDO.github.io/NOM-DU-DEPOT/` (HTTPS requis pour le GPS).

## Utilisation

- Bouton plein écran : masque la barre du navigateur (Android, ordinateur, iPad).
- Bouton installer : ajoute VHMaps à l'écran d'accueil (iPhone : Partager → Sur l'écran d'accueil).
- Ajouter un itinéraire : déposer le `.gpx` dans `itineraires/`, puis « Importer GPX » dans l'appli.

## Segments de couleurs dans un GPX

Chaque `<trk>` (et chaque `<trkseg>`) devient un segment distinct. La couleur est lue dans `<extensions>` :

```xml
<trk><name>Secteur Nord</name>
  <extensions><gpxx:TrackExtension><gpxx:DisplayColor>Red</gpxx:DisplayColor></gpxx:TrackExtension></extensions>   <!-- Garmin -->
  ...
<trk><name>Secteur Est</name><extensions><color>#1f7a5c</color></extensions>   <!-- hexadécimal -->
<trk><name>Secteur Sud</name><extensions><color>#FFFF9900</color></extensions> <!-- OsmAnd (AARRGGBB) -->
```

Sans couleur, une couleur est attribuée automatiquement. Une légende s'affiche dès qu'il y a plusieurs segments,
et le message de suivi indique le segment sur lequel on se trouve. Voir `itineraires/exemple-couleurs.gpx`.

## Cartes hors ligne (mode avion)

Bouton « carte » (colonne de boutons à droite) : choisir le fond (Plan IGN ou photographies aériennes IGN),
la zone (autour de l'itinéraire ou zone affichée) et le niveau de détail, puis « Télécharger ».
Les tuiles sont enregistrées dans le téléphone (Cache API) et servies par `sw.js` sans réseau.

- Les serveurs d'OpenStreetMap interdisent le téléchargement hors ligne : ce fond reste « en ligne uniquement ».
- Garder l'appli ouverte pendant le téléchargement. Les tuiles déjà présentes ne sont pas retéléchargées.
- Les cartes téléchargées survivent aux mises à jour de l'appli ; « Tout supprimer » les efface.
- Hors ligne, l'appli, les itinéraires déjà importés et le GPS fonctionnent ; l'import depuis le serveur et les zones non téléchargées non.

## Superpositions : PCRS

Dans le dialogue « Cartes » : cocher « PCRS » pour superposer le plan de corps de rue simplifié
(images très haute résolution de la Géoplateforme, WMS `data.geopf.fr/wms-r`, couche `PCRS.LAMB93`).

- Visible à partir du zoom 16, en ligne uniquement (non inclus dans les téléchargements hors ligne).
- Couverture partielle : uniquement là où le PCRS est diffusé en open data.
- Si le service change de nom de couche, modifier `PCRS_LAYER` dans `index.html`.

## Superposition : OLD (obligations légales de débroussaillement)

Dans le dialogue « Cartes » : cocher « OLD » (avec un curseur d'opacité, comme pour les parcelles cadastrales).
Les 277 zones (polygones verts) viennent de `donnees/old.json` ; toucher une zone affiche son numéro, la route,
le site, la surface, le traitement prévu (super-épareuse, bras long, manuel, évacuation, zone non OLD en %),
la contrainte, les observations et la justification, avec un lien Street View.

Fonctionne hors ligne (données enregistrées dans le téléphone après le premier chargement). Pour mettre à jour la couche :

```
python outils/preparer_old.py old.gpkg donnees/old.json
```

## Bouton position (réticule)

Premier bouton de la colonne de droite : affiche la position (avec la direction) sans enregistrer de tracé.

- 1er appui : active la position et centre la carte (point central dans le réticule).
- Si la carte est déplacée à la main, le suivi de la carte se met en pause (réticule vert) ; un appui recentre.
- Appui suivant : désactive la position (le GPS est coupé si le suivi n'est pas en cours).
- « Démarrer » reste le bouton qui enregistre le tracé ; les deux partagent une seule surveillance GPS.

## Dalle, référentiel routier et PR (Morbihan)

Dans le dialogue « Cartes » :
- Fond de carte « Carte du Morbihan (dalle ATD 2019) » : la dalle GeoTIFF, convertie en tuiles (zoom 8 à 13, agrandie au-delà).
- « Référentiel routier (couleur par site) » : lignes colorées par site (Questembert rouge, Muzillac orange,
  Grand-Champ vert, La Gacilly jaune, Vannes bleu), avec légende ; toucher une ligne affiche l'axe et les PR de début et de fin.
- « PR (points et numéros) » : points à partir du zoom 12, numéros à partir du zoom 14 (route + numéro à partir du zoom 16).

Les données sont dans `donnees/` (`dalle-morbihan.pack`, `lineaire.json`, `pr.json`, `old.json`). Elles sont enregistrées dans le téléphone
après le premier chargement (fonctionnement hors ligne) et mises à jour en arrière-plan quand elles changent sur le serveur.

### Régénérer les données

```
pip install rasterio pyproj shapely geopandas pyogrio pillow numpy
python outils/preparer_donnees.py --tif ATDSE2019_georef.tif --lineaire lineaireSE.gpkg --pr PRV_SE.gpkg --out donnees
```

Le GeoTIFF fourni n'a pas de système de coordonnées enregistré : il est supposé en Lambert-93 (EPSG:2154),
hypothèse vérifiée en superposant les lignes et les PR sur la dalle. Les couleurs des sites se règlent dans `index.html` (liste `SITES`).

## Recherche (loupe)

En plus des adresses, lieux-dits et coordonnées, la recherche accepte :

- une **route** : `D20`, `D 20`, `RD20`, `N165`, `D1C`, `DB198`… (affiche les routes correspondantes ; en choisir une
  recadre la carte dessus et la surligne 20 s) ;
- un **PR** : `D20 12`, `D20 PR12`, `D20-12` (centre la carte sur le PR avec un repère).
- une **abscisse** (PR + mètres) : `D20 33+669`, `D20 PR33+669`, `D20 33 + 669 m`. La position est calculée en partant du
  PR et en suivant le linéaire de référence (`lineaire.json`) dans le sens des PR croissants. Pour une route absente du
  linéaire, ou si le PR est trop éloigné du tracé, la position est estimée en comptant 1000 m entre deux PR
  successifs ; elle est alors signalée « position approximative ».

Cette recherche utilise `donnees/pr.json` et `donnees/lineaire.json` : elle fonctionne hors ligne et même si les
couches « Référentiel » et « PR » ne sont pas affichées.

## Localiser un PR (bouton repère)

Bouton « repère » de la colonne de droite : touchez-le, puis touchez un point proche d'une route du référentiel.
L'application affiche la route, le site, le **PR et l'abscisse** (ex. `PR 33+669`), la distance entre le point touché
et le tracé, et place un repère sur le tracé (avec lien Street View).

- Tolérance : environ 35 pixels autour du point touché (entre 30 et 300 m selon le zoom).
- Si plusieurs routes se superposent (ex. N165 et N165 G), elles sont toutes listées.
- Fonctionne avec `lineaire.json` et `pr.json`, hors ligne, sans afficher les couches « Référentiel » et « PR ».
- Les routes absentes de `lineaire.json` ne sont pas détectées.
