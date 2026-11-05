# VHMaps

Appli web (PWA) de suivi GPS : itinéraire de référence, tracé réel, direction (cap), export GPX.
Fonctionne hors ligne une fois installée (fonds de carte déjà consultés mis en cache).

## Structure

```
index.html
manifest.json
sw.js                 ← service worker (hors ligne)
itineraires.json      ← liste des circuits (obligatoire hors GitHub Pages, ex. Cloudflare) ; générée par outils/generer_itineraires.py
itineraires/          ← déposer ici les fichiers .gpx
donnees/              ← dalle (fond de plan), référentiel routier, PR, carte SCAN 25 (donnees/scan25/)
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
  - GitHub Pages : la liste est lue automatiquement via l'API GitHub.
  - Cloudflare Pages (ou autre hébergeur) : relancer `python outils/generer_itineraires.py` pour mettre à jour `itineraires.json`, puis redéployer.
    Avec un dépôt Git relié à Cloudflare, on peut l'automatiser : *Build command* `python3 outils/generer_itineraires.py`.

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

Bouton « carte » (colonne de boutons à droite) : choisir le fond (Plan IGN, photographies aériennes IGN actuelles, ou photographies aériennes anciennes 1965-1980 et 1980-1995),
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
Les 277 zones (polygones jaunes) viennent de `donnees/old.json` ; toucher une zone affiche son numéro, la route,
le site, la surface, le traitement prévu (super-épareuse, bras long, manuel, évacuation, zone non OLD en %),
la contrainte, les observations et la justification, avec un lien Street View.

Fonctionne hors ligne (données enregistrées dans le téléphone après le premier chargement). Pour mettre à jour la couche :

```
python outils/preparer_old.py old.gpkg donnees/old.json
```

## Superposition : carte IGN SCAN 25 (dalles)

Dans le dialogue « Cartes » : cocher « Carte IGN SCAN 25 » (avec un curseur d'opacité). La carte se pose
au-dessus du fond choisi (Plan IGN, photos…) : là où il n'y a pas de dalle, le fond reste visible.
Le PCRS, le référentiel, les PR et les OLD restent par-dessus.

Les dalles GeoTIFF (ex. `SC25_TOUR_0250_6730_L93.tif`, Lambert-93) sont converties une fois pour toutes :

```
pip install rasterio numpy pillow
python outils/preparer_scan25.py "C:\chemin\vers\dossier_des_dalles"
```

Le script lit toutes les `.tif` du dossier (sous-dossiers compris ; les `.aux.xml` sont inutiles), les assemble
sans raccord, les reprojette et écrit `donnees/scan25/` :

- `index.json` : description de la couche (emprise, zooms, liste des secteurs) ;
- `apercu.pack` : la vue d'ensemble (petits zooms) ;
- `11-XXXX-YYYY.pack` : un fichier par secteur d'environ 13 × 13 km, avec tous les zooms détaillés.

Il suffit ensuite de publier le dossier `donnees/scan25/` avec le reste (quelques dizaines de fichiers de quelques Mo,
compatibles avec l'envoi par glisser-déposer de GitHub et Cloudflare Pages, limités à 25 Mo par fichier).
Compter quelques minutes de calcul pour 40 à 50 dalles.

- **Hors ligne** : l'appli ne télécharge que les secteurs affichés, puis les garde dans le téléphone. Pour préparer
  une tournée sans réseau : « Hors ligne » → cocher « Inclure la carte SCAN 25 » → « Télécharger » (autour de
  l'itinéraire ou zone affichée). « Tout supprimer » efface aussi ces secteurs.
- **Ajout ou remplacement de dalles** : relancer le script (le dossier `donnees/scan25/` est régénéré), puis republier.
  Les téléphones mettent la carte à jour d'eux-mêmes ; les secteurs disparus sont retirés.
- **Netteté** : par défaut, détail maximal au zoom 15 (≈ 3 m par pixel, jusqu'à ≈ 4 Mo par dalle de 10 × 10 km).
  `--zmax 16` donne une carte aussi nette que les dalles d'origine en zoomant, mais environ 3 fois plus lourde.
  Autres options : `--qualite 80` (WebP), `--processus N`, `--nom`, `--attribution` (`python outils/preparer_scan25.py -h`).
- **Licence** : les dalles publiées sur un site public sont accessibles à tous ; vérifier que la licence IGN des SCAN 25 le permet.

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
