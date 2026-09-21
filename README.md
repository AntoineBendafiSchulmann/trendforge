# TrendForge

Générateur local de vidéos courtes verticales (9:16), destinées à être publiées
manuellement. Pour l'instant il ne rend qu'une composition de démonstration : le
pipeline (script, narration, sous-titres) reste à écrire.

## Prérequis

- Node.js 24.21.0 (voir `.nvmrc`)
- FFmpeg 9.0.2, avec `ffmpeg` et `ffprobe` dans le PATH

## Installation

```bash
npm ci
```

## Commandes

```bash
npm run generate      # rend output/video-001.mp4 (1080x1920, 30 fps, H.264)
npm run typecheck
npm run lint
npm run format        # npm run format:check pour vérifier sans modifier
npm test
```

Le premier `npm run generate` télécharge Chrome Headless Shell (~113 Mo) dans
`node_modules/`. Le fichier de sortie est écrasé à chaque génération.
