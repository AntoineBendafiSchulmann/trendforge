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

## Médias de fond (Pexels)

Un fond de scène se déclare de deux façons dans `content/demo.json` :

```json
{ "mode": "local",  "type": "image", "src": "demo/deep-portrait.jpg" }
{ "mode": "search", "kind": "video", "query": "city skyline night" }
```

Un média `local` est lu tel quel sous `assets/`. Un média `search` est résolu au
premier `npm run generate` : recherche [Pexels](https://www.pexels.com/api/documentation/)
en orientation portrait, sélection déterministe du meilleur candidat, téléchargement
dans `assets/generated/media/`, puis écriture d'une entrée dans `content/media-lock.json`.

Une image de fond reçoit un léger zoom ; une vidéo de fond est jouée muette et bouclée
si la scène dure plus longtemps que le clip.

Le lock est versionné et fait foi. Aux exécutions suivantes, une requête déjà
verrouillée est relue depuis le disque : aucun appel réseau, donc aucune clé requise et
aucun quota consommé. Si le fichier verrouillé a disparu ou si son empreinte SHA-256 ne
correspond plus, la génération s'arrête sur une erreur explicite — jamais de nouvelle
recherche silencieuse. Pour relancer une recherche, retirer l'entrée du lock.

Les fichiers téléchargés ne sont pas versionnés (`assets/generated/`) : un clone neuf
doit donc récupérer les médias ou vider `content/media-lock.json`.

La clé se lit dans `PEXELS_API_KEY` :

```bash
cp .env.example .env    # puis renseigner PEXELS_API_KEY dans .env
```

`.env` n'est jamais versionné ; `.env.example` l'est, et ne contient aucune valeur.
`npm run generate` le charge s'il existe (`node --env-file-if-exists=.env`). La clé
n'est nécessaire que pour résoudre une requête absente du lock.
