import { describe, expect, it } from 'vitest';
import {
  imageZoomScale,
  MEDIA_BACKGROUND_MAX_ZOOM,
  OUTRO_DURATION_FRAMES,
  OUTRO_ENTER_FRAMES,
  OUTRO_FADE_OUT_FRAMES,
  outroOpacity,
  VERTICAL_9_16,
  videoFormatSchema,
} from '../src/config.ts';

describe('videoFormatSchema', () => {
  it('accepte le format vertical 1080x1920 @30fps', () => {
    expect(videoFormatSchema.parse(VERTICAL_9_16)).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
    });
  });

  it('rejette une dimension non entiere', () => {
    expect(() => videoFormatSchema.parse({ width: 1080.5, height: 1920, fps: 30 })).toThrow();
  });

  it('rejette une valeur negative', () => {
    expect(() => videoFormatSchema.parse({ width: 1080, height: -1920, fps: 30 })).toThrow();
  });
});

describe('MEDIA_BACKGROUND_MAX_ZOOM', () => {
  it('reste un agrandissement subtil', () => {
    expect(MEDIA_BACKGROUND_MAX_ZOOM).toBeGreaterThan(1);
    expect(MEDIA_BACKGROUND_MAX_ZOOM).toBeLessThanOrEqual(1.06);
  });

  it('impose une source 1134x2016 minimum, sur des bornes entieres exactes', () => {
    expect(VERTICAL_9_16.width * MEDIA_BACKGROUND_MAX_ZOOM).toBe(1134);
    expect(VERTICAL_9_16.height * MEDIA_BACKGROUND_MAX_ZOOM).toBe(2016);
  });
});

describe('imageZoomScale', () => {
  const DUREE = 200;

  it('part de 1 et finit exactement au zoom maximal', () => {
    expect(imageZoomScale(0, DUREE)).toBe(1);
    expect(imageZoomScale(DUREE, DUREE)).toBe(MEDIA_BACKGROUND_MAX_ZOOM);
  });

  it('ne sort jamais de [1, zoom maximal]', () => {
    for (let frame = -20; frame <= DUREE + 60; frame += 1) {
      const scale = imageZoomScale(frame, DUREE);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(scale).toBeLessThanOrEqual(MEDIA_BACKGROUND_MAX_ZOOM);
    }
  });

  it('croit sans jamais reculer', () => {
    let precedent = 0;
    for (let frame = 0; frame <= DUREE; frame += 1) {
      const scale = imageZoomScale(frame, DUREE);
      expect(scale).toBeGreaterThanOrEqual(precedent);
      precedent = scale;
    }
  });

  it('atteint la meme amplitude quelle que soit la duree de la scene', () => {
    for (const duree of [30, 120, 400]) {
      expect(imageZoomScale(duree, duree)).toBe(MEDIA_BACKGROUND_MAX_ZOOM);
      expect(imageZoomScale(duree / 2, duree)).toBeCloseTo(1 + (MEDIA_BACKGROUND_MAX_ZOOM - 1) / 2);
    }
  });

  it('reste defini sur une duree nulle', () => {
    expect(imageZoomScale(0, 0)).toBe(MEDIA_BACKGROUND_MAX_ZOOM);
  });
});

describe('outroOpacity', () => {
  const DUREE = OUTRO_DURATION_FRAMES;

  it('dure entre deux et trois secondes a 30 fps', () => {
    expect(DUREE / VERTICAL_9_16.fps).toBeGreaterThanOrEqual(2);
    expect(DUREE / VERTICAL_9_16.fps).toBeLessThanOrEqual(3);
  });

  it('part du noir et devient pleinement visible apres l apparition', () => {
    expect(outroOpacity(0, DUREE)).toBe(0);
    expect(outroOpacity(OUTRO_ENTER_FRAMES, DUREE)).toBe(1);
  });

  it('tient a pleine opacite jusqu au debut du fondu final', () => {
    const debutFondu = DUREE - 1 - OUTRO_FADE_OUT_FRAMES;
    expect(outroOpacity(debutFondu, DUREE)).toBe(1);
    expect(outroOpacity(debutFondu + 1, DUREE)).toBeLessThan(1);
  });

  it('rend la derniere frame totalement noire', () => {
    expect(outroOpacity(DUREE - 1, DUREE)).toBe(0);
  });

  it('decroit strictement pendant le fondu final', () => {
    const debutFondu = DUREE - 1 - OUTRO_FADE_OUT_FRAMES;
    let precedent = outroOpacity(debutFondu, DUREE);
    for (let frame = debutFondu + 1; frame <= DUREE - 1; frame += 1) {
      const opacite = outroOpacity(frame, DUREE);
      expect(opacite).toBeLessThan(precedent);
      precedent = opacite;
    }
  });

  it('reste dans [0, 1] sur toute la sequence', () => {
    for (let frame = 0; frame < DUREE; frame += 1) {
      const opacite = outroOpacity(frame, DUREE);
      expect(opacite).toBeGreaterThanOrEqual(0);
      expect(opacite).toBeLessThanOrEqual(1);
    }
  });
});
