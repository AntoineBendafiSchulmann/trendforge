# TrendForge

Générateur local de vidéos courtes verticales (9:16), destinées à être publiées
manuellement. Une vidéo est décrite par un fichier JSON de scènes — voir
`content/demo.json` — et la narration est synthétisée localement. La génération
automatique du contenu et la détection de tendances restent à écrire.

## Prérequis

- Node.js 24.21.0 (voir `.nvmrc`)
- FFmpeg 9.0.2, avec `ffmpeg` et `ffprobe` dans le PATH
- Python 3.12 avec un environnement local `.venv/`
- la voix Piper `fr_FR-siwis-medium` sous `models/piper/fr_FR-siwis-medium/`
  (`.onnx` et `.onnx.json`, depuis le dépôt `rhasspy/piper-voices`)

## Installation

```bash
npm ci
python -m venv .venv
.venv/Scripts/python -m pip install "piper-tts[alignment]==1.8.0"   # .venv/bin/python sous Linux
```

L'extra `alignment` ajoute le paquet `onnx`, nécessaire pour exposer l'alignement
phonème/échantillons du modèle. Le `.onnx` téléchargé n'est jamais modifié : le patch
est appliqué en mémoire à chaque chargement.

## Commandes

```bash
npm run generate      # valide le contenu, synthétise la voix, rend output/video-001.mp4
npm run typecheck
npm run lint
npm run format        # npm run format:check pour vérifier sans modifier
npm test
```

La sortie est un MP4 vertical 1080x1920, 30 fps, H.264 avec une piste audio, écrasée
à chaque génération. La durée de chaque scène est déduite de la durée réelle de sa
narration. Les WAV intermédiaires sont régénérés dans `assets/generated/audio/`.
Le premier `npm run generate` télécharge Chrome Headless Shell (~113 Mo) dans
`node_modules/`.

## Synthèse vocale

La narration est produite hors ligne par [Piper](https://github.com/OHF-Voice/piper1-gpl)
(moteur sous GPL-3.0), avec la voix `fr_FR-siwis-medium`. Cette voix provient du dépôt
`rhasspy/piper-voices`, dont la fiche indique une licence MIT et un
jeu de données source [SIWIS](https://datashare.is.ed.ac.uk/handle/10283/2353) sous
CC-BY 4.0. Aucun service en ligne n'est appelé et aucune clé d'API n'est requise.

## Recherche de médias (Pexels)

Le client [Pexels](https://www.pexels.com/api/documentation/) sait chercher des photos
et des vidéos portrait, mais **il n'est pas encore branché sur `npm run generate`** :
un média `mode: "search"` est refusé explicitement tant que la sélection n'est pas
implémentée. La génération reste donc entièrement hors ligne.

La clé se lit dans `PEXELS_API_KEY` :

```bash
cp .env.example .env    # puis renseigner PEXELS_API_KEY dans .env
```

`.env` n'est jamais versionné ; `.env.example` l'est, et ne contient aucune valeur.
Le code ne charge pas `.env` automatiquement : tant que Pexels n'est pas câblé au
pipeline, la variable doit être fournie explicitement, par exemple avec
`node --env-file=.env`.
