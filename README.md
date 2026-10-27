# Mon itinéraire

Appli web de suivi GPS (Leaflet + OpenStreetMap) : suivi d'un itinéraire de référence, enregistrement du tracé réel, export GPX.

## Structure

```
index.html
manifest.json
itineraires.json      ← liste de repli (facultative)
itineraires/          ← déposer ici les fichiers .gpx
icons/
.nojekyll
```

## Publier sur GitHub Pages

1. Créer un dépôt public et y envoyer tout le contenu de ce dossier (à la racine).
2. Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. L'appli est disponible sur `https://PSEUDO.github.io/NOM-DU-DEPOT/` (HTTPS requis pour la géolocalisation).

## Ajouter un itinéraire

Déposer le `.gpx` dans `itineraires/` puis commit. Le bouton « Importer GPX » liste automatiquement
les fichiers du dossier (via l'API GitHub). Sur un domaine personnalisé, la liste est lue dans
`itineraires.json` :

```json
[ { "name": "Boucle du lac", "file": "itineraires/boucle-lac.gpx" } ]
```
