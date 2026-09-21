# TrendForge

Générateur local de vidéos courtes verticales (9:16), destinées à être publiées
manuellement. Une vidéo est décrite par un fichier JSON de scènes — voir
`content/demo.json`. La narration, la génération automatique du contenu et la
détection de tendances restent à écrire.

## Prérequis

- Node.js 24.21.0 (voir `.nvmrc`)
- FFmpeg 9.0.2, avec `ffmpeg` et `ffprobe` dans le PATH

## Installation

```bash
npm ci
```

## Commandes

```bash
npm run generate      # valide content/demo.json, rend output/video-001.mp4
npm run typecheck
npm run lint
npm run format        # npm run format:check pour vérifier sans modifier
npm test
```

La sortie est un MP4 vertical 1080x1920, 30 fps, H.264, écrasé à chaque génération.
Le premier `npm run generate` télécharge Chrome Headless Shell (~113 Mo) dans
`node_modules/`.
