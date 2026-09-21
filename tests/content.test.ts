import { describe, expect, it } from 'vitest';
import demoContent from '../content/demo.json' with { type: 'json' };
import {
  isPathInsideRoot,
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
    expect(demo.scenes).toHaveLength(6);
  });

  it('exerce les quatre types', () => {
    expect(new Set(demo.scenes.map((scene) => scene.type))).toEqual(
      new Set(['hook', 'statement', 'stat', 'comparison']),
    );
  });

  it('dure 555 frames', () => {
    expect(totalDurationInFrames(demo.scenes, FPS)).toBe(555);
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

const WIN_SEP = String.fromCharCode(92);

describe('media', () => {
  const hookWith = (src: string) => ({
    type: 'hook',
    text: 'a',
    media: { type: 'image', src },
    durationInSeconds: 2,
  });

  it('accepte un media image sur hook', () => {
    expect(parseScene(hookWith('demo/photo-01.jpg'))?.type).toBe('hook');
  });

  it('accepte un media image sur statement', () => {
    const scene = { ...statement, media: { type: 'image', src: 'demo/photo-01.jpg' } };
    expect(parseScene(scene)?.type).toBe('statement');
  });

  it('accepte une scene hook sans media', () => {
    expect(parseScene({ type: 'hook', text: 'a', durationInSeconds: 2 })?.type).toBe('hook');
  });

  it('accepte une scene statement sans media', () => {
    expect(parseScene(statement)?.type).toBe('statement');
  });

  it('rejette un media sur stat', () => {
    expect(() =>
      parseScene({ ...stat, media: { type: 'image', src: 'demo/photo-01.jpg' } }),
    ).toThrow();
  });

  it('rejette un media sur comparison', () => {
    expect(() =>
      parseScene({ ...comparison, media: { type: 'image', src: 'demo/photo-01.jpg' } }),
    ).toThrow();
  });

  it('rejette un type de media inconnu', () => {
    const scene = { ...statement, media: { type: 'video', src: 'demo/clip.mp4' } };
    expect(() => parseScene(scene)).toThrow();
  });

  it.each(['demo/a.jpg', 'demo/a.jpeg', 'demo/a.png', 'demo/a.webp'])('accepte %s', (src) => {
    expect(parseScene(hookWith(src))?.type).toBe('hook');
  });

  it.each([
    'demo/a.gif',
    'demo/a.svg',
    'demo/a.avif',
    'demo/a.txt',
    'demo/a.JPG',
    'demo/noextension',
    '../secret.jpg',
    'demo/../../secret.jpg',
    '/etc/passwd.jpg',
    `C:${WIN_SEP}photo.jpg`,
    `demo${WIN_SEP}photo.jpg`,
    'http://example.com/a.jpg',
    'https://example.com/a.jpg',
    '',
  ])('rejette %s', (src) => {
    expect(() => parseScene(hookWith(src))).toThrow();
  });
});

describe('isPathInsideRoot', () => {
  const root = `C:${WIN_SEP}p${WIN_SEP}assets`;

  it('accepte un chemin sous la racine', () => {
    expect(isPathInsideRoot(root, `${root}${WIN_SEP}demo${WIN_SEP}a.jpg`, WIN_SEP)).toBe(true);
    expect(isPathInsideRoot('/p/assets', '/p/assets/demo/a.jpg', '/')).toBe(true);
  });

  it('accepte la racine elle-meme', () => {
    expect(isPathInsideRoot('/p/assets', '/p/assets', '/')).toBe(true);
  });

  it('rejette un chemin en dehors de la racine', () => {
    expect(isPathInsideRoot('/p/assets', '/p/secret.jpg', '/')).toBe(false);
    expect(isPathInsideRoot(root, `C:${WIN_SEP}p${WIN_SEP}secret.jpg`, WIN_SEP)).toBe(false);
  });

  it('rejette un prefixe trompeur', () => {
    expect(isPathInsideRoot('/p/assets', '/p/assets-prive/a.jpg', '/')).toBe(false);
    expect(isPathInsideRoot(root, `${root}2${WIN_SEP}a.jpg`, WIN_SEP)).toBe(false);
  });
});
