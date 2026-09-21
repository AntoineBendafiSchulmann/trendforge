# TrendForge

Générateur local de vidéos courtes verticales (9:16), destinées à être publiées
manuellement. Seul le socle technique est en place pour l'instant : le pipeline de
génération n'est pas encore écrit.

## Prérequis

- Node.js 24.21.0 (voir `.nvmrc`)
- FFmpeg 9.0.2, avec `ffmpeg` et `ffprobe` dans le PATH

## Installation

```bash
npm ci
```

## Commandes

```bash
npm run generate      # point d'entrée du générateur
npm run typecheck
npm run lint
npm run format        # npm run format:check pour vérifier sans modifier
npm test
```
