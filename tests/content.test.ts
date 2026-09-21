import { describe, expect, it } from 'vitest';
import demoContent from '../content/demo.json' with { type: 'json' };
import {
  sceneDurationsInFrames,
  secondsToFrames,
  totalDurationInFrames,
  videoContentSchema,
  type Scene,
} from '../src/content.ts';

const FPS = 30;

const parseScene = (scene: unknown) => videoContentSchema.parse({ scenes: [scene] }).scenes[0];

const hook = { type: 'hook', kicker: 'A', text: 'Un titre.', durationInSeconds: 2 };
const statement = {
  type: 'statement',
  text: 'Une idee.',
  subtext: 'Une nuance.',
  durationInSeconds: 2,
};
const stat = { type: 'stat', value: '4', label: 'types', caption: 'a b c', durationInSeconds: 2 };
const comparison = {
  type: 'comparison',
  label: 'Avant / apres',
  items: [
    { label: 'Avant', value: '1' },
    { label: 'Apres', value: '4' },
  ],
  durationInSeconds: 2,
};

describe('types de scenes', () => {
  it('accepte les quatre types', () => {
    expect(parseScene(hook)?.type).toBe('hook');
    expect(parseScene(statement)?.type).toBe('statement');
    expect(parseScene(stat)?.type).toBe('stat');
    expect(parseScene(comparison)?.type).toBe('comparison');
  });

  it('accepte les champs optionnels absents', () => {
    expect(parseScene({ type: 'hook', text: 'a', durationInSeconds: 1 })?.type).toBe('hook');
    expect(parseScene({ type: 'statement', text: 'a', durationInSeconds: 1 })?.type).toBe(
      'statement',
    );
    expect(parseScene({ type: 'stat', value: '1', label: 'a', durationInSeconds: 1 })?.type).toBe(
      'stat',
    );
  });

  it('rejette un type inconnu', () => {
    expect(() => parseScene({ type: 'conclusion', text: 'a', durationInSeconds: 1 })).toThrow();
  });

  it('rejette un champ requis absent', () => {
    expect(() => parseScene({ type: 'hook', durationInSeconds: 1 })).toThrow();
    expect(() => parseScene({ type: 'stat', value: '4', durationInSeconds: 1 })).toThrow();
    expect(() => parseScene({ type: 'comparison', label: 'a', durationInSeconds: 1 })).toThrow();
  });

  it('rejette un champ appartenant a une autre variante', () => {
    expect(() => parseScene({ ...hook, subtext: 'intrus' })).toThrow();
    expect(() => parseScene({ ...stat, text: 'intrus' })).toThrow();
    expect(() => parseScene({ ...statement, kicker: 'intrus' })).toThrow();
  });

  it('exige exactement deux items de comparaison', () => {
    expect(() => parseScene({ ...comparison, items: [comparison.items[0]] })).toThrow();
    expect(() =>
      parseScene({ ...comparison, items: [...comparison.items, { label: 'Autre', value: '9' }] }),
    ).toThrow();
  });

  it('rejette les depassements de longueur', () => {
    expect(() => parseScene({ ...hook, text: 'x'.repeat(71) })).toThrow();
    expect(() => parseScene({ ...stat, value: 'x'.repeat(9) })).toThrow();
  });

  it('rejette une duree nulle ou negative', () => {
    expect(() => parseScene({ ...statement, durationInSeconds: 0 })).toThrow();
    expect(() => parseScene({ ...statement, durationInSeconds: -1 })).toThrow();
  });

  it('rejette une duree inferieure au plancher de 0.6 s', () => {
    expect(() => parseScene({ ...statement, durationInSeconds: 0.5 })).toThrow();
  });

  it('accepte une duree de exactement 0.6 s', () => {
    expect(parseScene({ ...statement, durationInSeconds: 0.6 })?.durationInSeconds).toBe(0.6);
  });

  it('rejette une duree superieure a 30 s', () => {
    expect(() => parseScene({ ...statement, durationInSeconds: 30.1 })).toThrow();
  });

  it('rejette un tableau de scenes vide', () => {
    expect(() => videoContentSchema.parse({ scenes: [] })).toThrow();
  });
});

describe('content/demo.json', () => {
  const demo = videoContentSchema.parse(demoContent);

  it('est valide', () => {
    expect(demo.scenes).toHaveLength(5);
  });

  it('exerce les quatre types', () => {
    expect(new Set(demo.scenes.map((scene) => scene.type))).toEqual(
      new Set(['hook', 'statement', 'stat', 'comparison']),
    );
  });

  it('dure 420 frames', () => {
    expect(totalDurationInFrames(demo.scenes, FPS)).toBe(420);
  });
});

describe('conversion en frames', () => {
  const scenes: Scene[] = [2.5, 3, 3, 3.5, 2].map((durationInSeconds) => ({
    type: 'statement',
    text: 'a',
    durationInSeconds,
  }));

  it('convertit chaque duree de scene', () => {
    expect(sceneDurationsInFrames(scenes, FPS)).toEqual([75, 90, 90, 105, 60]);
  });

  it('totalise 420 frames', () => {
    expect(totalDurationInFrames(scenes, FPS)).toBe(420);
  });

  it('garantit au moins une frame par scene', () => {
    expect(secondsToFrames(0.001, FPS)).toBe(1);
  });

  it('total identique a la somme des durees deja arrondies', () => {
    const awkward: Scene[] = [0.33, 0.33, 0.34, 1.016, 2.983].map((durationInSeconds) => ({
      type: 'statement',
      text: 'a',
      durationInSeconds,
    }));
    const sum = sceneDurationsInFrames(awkward, FPS).reduce((total, frames) => total + frames, 0);

    expect(totalDurationInFrames(awkward, FPS)).toBe(sum);
    expect(totalDurationInFrames(awkward, FPS)).not.toBe(
      Math.round(awkward.reduce((total, scene) => total + scene.durationInSeconds, 0) * FPS),
    );
  });
});
