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
