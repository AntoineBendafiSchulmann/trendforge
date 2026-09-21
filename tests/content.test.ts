import { describe, expect, it } from 'vitest';
import demoContent from '../content/demo.json' with { type: 'json' };
import {
  sceneDurationsInFrames,
  secondsToFrames,
  totalDurationInFrames,
  videoContentSchema,
} from '../src/content.ts';

const FPS = 30;

describe('videoContentSchema', () => {
  it('accepte le contenu de demonstration', () => {
    const parsed = videoContentSchema.parse(demoContent);
    expect(parsed.scenes).toHaveLength(3);
    expect(parsed.scenes[1]?.subtext).toBe("Le moteur de rendu n'en sait rien.");
  });

  it('rejette un tableau de scenes vide', () => {
    expect(() => videoContentSchema.parse({ scenes: [] })).toThrow();
  });

  it('rejette un texte vide', () => {
    expect(() =>
      videoContentSchema.parse({ scenes: [{ text: '', durationInSeconds: 1 }] }),
    ).toThrow();
  });

  it('rejette un texte absent', () => {
    expect(() => videoContentSchema.parse({ scenes: [{ durationInSeconds: 1 }] })).toThrow();
  });

  it('rejette une duree nulle', () => {
    expect(() =>
      videoContentSchema.parse({ scenes: [{ text: 'a', durationInSeconds: 0 }] }),
    ).toThrow();
  });

  it('rejette une duree negative', () => {
    expect(() =>
      videoContentSchema.parse({ scenes: [{ text: 'a', durationInSeconds: -1 }] }),
    ).toThrow();
  });
});

describe('conversion en frames', () => {
  const scenes = [2.5, 3, 2].map((durationInSeconds) => ({ text: 'a', durationInSeconds }));

  it('convertit chaque duree de scene', () => {
    expect(sceneDurationsInFrames(scenes, FPS)).toEqual([75, 90, 60]);
  });

  it('totalise 225 frames', () => {
    expect(totalDurationInFrames(scenes, FPS)).toBe(225);
  });

  it('garantit au moins une frame par scene', () => {
    expect(secondsToFrames(0.001, FPS)).toBe(1);
    expect(totalDurationInFrames([{ text: 'a', durationInSeconds: 0.001 }], FPS)).toBe(1);
  });

  it('total identique a la somme des durees deja arrondies', () => {
    const awkward = [0.33, 0.33, 0.34, 1.016, 2.983].map((durationInSeconds) => ({
      text: 'a',
      durationInSeconds,
    }));
    const perScene = sceneDurationsInFrames(awkward, FPS);
    const sum = perScene.reduce((total, frames) => total + frames, 0);

    expect(totalDurationInFrames(awkward, FPS)).toBe(sum);
    expect(totalDurationInFrames(awkward, FPS)).not.toBe(
      Math.round(awkward.reduce((total, scene) => total + scene.durationInSeconds, 0) * FPS),
    );
  });
});
