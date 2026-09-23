import { describe, expect, it } from 'vitest';
import demoContent from '../content/demo.json' with { type: 'json' };
import {
  audioDurationToFrames,
  EXIT_PADDING_FRAMES,
  isPathInsideRoot,
  resolvedVideoContentSchema,
  totalResolvedFrames,
  videoContentSchema,
  type ResolvedScene,
} from '../src/content.ts';

const FPS = 30;
const WIN_SEP = String.fromCharCode(92);

const parseScene = (scene: unknown) => videoContentSchema.parse({ scenes: [scene] }).scenes[0];
const parseResolved = (scene: unknown) =>
  resolvedVideoContentSchema.parse({ scenes: [scene] }).scenes[0];

const hook = { type: 'hook', kicker: 'A', text: 'Un titre.', narration: 'Une narration.' };
const statement = { type: 'statement', text: 'Une idee.', narration: 'Une narration.' };
const stat = { type: 'stat', value: '4', label: 'types', narration: 'Une narration.' };
const comparison = {
  type: 'comparison',
  label: 'Avant / apres',
  items: [
    { label: 'Avant', value: '1' },
    { label: 'Apres', value: '4' },
  ],
  narration: 'Une narration.',
};
const resolvedExtra = {
  audioSrc: 'generated/audio/scene-01.wav',
  durationInFrames: 38,
  captions: [],
};

describe('contrat redige', () => {
  it.each([
    ['hook', hook],
    ['statement', statement],
    ['stat', stat],
    ['comparison', comparison],
  ])('accepte une scene %s narree', (type, scene) => {
    expect(parseScene(scene)?.type).toBe(type);
  });

  it.each([
    ['hook', hook],
    ['statement', statement],
    ['stat', stat],
    ['comparison', comparison],
  ])('exige la narration sur %s', (_type, scene) => {
    const withoutNarration: Record<string, unknown> = { ...scene };
    delete withoutNarration['narration'];
    expect(() => parseScene(withoutNarration)).toThrow();
  });

  it('rejette une narration vide', () => {
    expect(() => parseScene({ ...statement, narration: '' })).toThrow();
  });

  it('rejette une narration faite uniquement d espaces', () => {
    expect(() => parseScene({ ...statement, narration: '   ' })).toThrow();
  });

  it('accepte une narration de exactement 300 caracteres', () => {
    expect(parseScene({ ...statement, narration: 'a'.repeat(300) })?.type).toBe('statement');
  });

  it('rejette une narration de plus de 300 caracteres', () => {
    expect(() => parseScene({ ...statement, narration: 'a'.repeat(301) })).toThrow();
  });

  it('rejette durationInSeconds, desormais hors contrat', () => {
    expect(() => parseScene({ ...statement, durationInSeconds: 3 })).toThrow();
    expect(() => parseScene({ ...hook, durationInSeconds: 3 })).toThrow();
  });

  it('rejette un type inconnu', () => {
    expect(() => parseScene({ type: 'conclusion', text: 'a', narration: 'b' })).toThrow();
  });

  it('rejette un champ appartenant a une autre variante', () => {
    expect(() => parseScene({ ...hook, subtext: 'intrus' })).toThrow();
    expect(() => parseScene({ ...stat, text: 'intrus' })).toThrow();
  });

  it('exige exactement deux items de comparaison', () => {
    expect(() => parseScene({ ...comparison, items: [comparison.items[0]] })).toThrow();
  });

  it('rejette un tableau de scenes vide', () => {
    expect(() => videoContentSchema.parse({ scenes: [] })).toThrow();
  });
});

describe('media', () => {
  const withMedia = (src: string) => ({ ...hook, media: { type: 'image', src } });

  it('accepte un media sur hook et statement', () => {
    expect(parseScene(withMedia('demo/a.jpg'))?.type).toBe('hook');
    expect(parseScene({ ...statement, media: { type: 'image', src: 'demo/a.jpg' } })?.type).toBe(
      'statement',
    );
  });

  it('rejette un media sur stat et comparison', () => {
    expect(() => parseScene({ ...stat, media: { type: 'image', src: 'demo/a.jpg' } })).toThrow();
    expect(() =>
      parseScene({ ...comparison, media: { type: 'image', src: 'demo/a.jpg' } }),
    ).toThrow();
  });

  it.each(['demo/a.jpg', 'demo/a.jpeg', 'demo/a.png', 'demo/a.webp'])('accepte %s', (src) => {
    expect(parseScene(withMedia(src))?.type).toBe('hook');
  });

  it.each([
    'demo/a.gif',
    'demo/a.svg',
    'demo/a.avif',
    'demo/a.JPG',
    'demo/noextension',
    '../secret.jpg',
    '/etc/passwd.jpg',
    `C:${WIN_SEP}photo.jpg`,
    `demo${WIN_SEP}photo.jpg`,
    'http://example.com/a.jpg',
    '',
  ])('rejette %s', (src) => {
    expect(() => parseScene(withMedia(src))).toThrow();
  });
});

describe('contrat resolu', () => {
  it('accepte une scene resolue complete', () => {
    const scene = parseResolved({ ...statement, ...resolvedExtra });
    expect(scene?.audioSrc).toBe('generated/audio/scene-01.wav');
    expect(scene?.durationInFrames).toBe(38);
  });

  it('exige audioSrc', () => {
    expect(() => parseResolved({ ...statement, durationInFrames: 38 })).toThrow();
  });

  it('exige durationInFrames', () => {
    expect(() =>
      parseResolved({ ...statement, audioSrc: 'generated/audio/scene-01.wav' }),
    ).toThrow();
  });

  it.each([0, -1, 1.5])('rejette durationInFrames = %s', (durationInFrames) => {
    expect(() => parseResolved({ ...statement, ...resolvedExtra, durationInFrames })).toThrow();
  });

  it.each(['generated/audio/scene-01.mp3', '../secret.wav', `a${WIN_SEP}b.wav`, ''])(
    'rejette audioSrc %s',
    (audioSrc) => {
      expect(() => parseResolved({ ...statement, ...resolvedExtra, audioSrc })).toThrow();
    },
  );

  it('exige le champ captions', () => {
    const withoutCaptions: Record<string, unknown> = { ...statement, ...resolvedExtra };
    delete withoutCaptions['captions'];
    expect(() => parseResolved(withoutCaptions)).toThrow();
  });

  const cue = (count: number, from = 0) => ({
    words: Array.from({ length: count }, (_, index) => ({
      text: 'mot',
      startFrame: from + index * 3,
      endFrame: from + index * 3 + 3,
    })),
  });

  it('accepte une cue de un a cinq mots', () => {
    expect(
      parseResolved({ ...statement, ...resolvedExtra, captions: [cue(1)] })?.captions,
    ).toHaveLength(1);
    expect(
      parseResolved({ ...statement, ...resolvedExtra, captions: [cue(5)] })?.captions,
    ).toHaveLength(1);
    expect(() => parseResolved({ ...statement, ...resolvedExtra, captions: [cue(6)] })).toThrow();
    expect(() => parseResolved({ ...statement, ...resolvedExtra, captions: [cue(0)] })).toThrow();
  });

  it('accepte des cues successives ordonnees', () => {
    const captions = [cue(2), cue(2, 10)];
    expect(parseResolved({ ...statement, ...resolvedExtra, captions })?.captions).toHaveLength(2);
  });

  const withWords = (...words: unknown[]) => ({
    ...statement,
    ...resolvedExtra,
    captions: [{ words }],
  });

  it('rejette endFrame inferieur a startFrame', () => {
    expect(() => parseResolved(withWords({ text: 'a', startFrame: 10, endFrame: 4 }))).toThrow();
  });

  it('rejette endFrame egal a startFrame', () => {
    expect(() => parseResolved(withWords({ text: 'a', startFrame: 5, endFrame: 5 }))).toThrow();
  });

  it('rejette des mots non monotones', () => {
    expect(() =>
      parseResolved(
        withWords(
          { text: 'a', startFrame: 10, endFrame: 14 },
          { text: 'b', startFrame: 0, endFrame: 4 },
        ),
      ),
    ).toThrow();
  });

  it('rejette un recouvrement entre deux mots', () => {
    expect(() =>
      parseResolved(
        withWords(
          { text: 'a', startFrame: 0, endFrame: 10 },
          { text: 'b', startFrame: 5, endFrame: 14 },
        ),
      ),
    ).toThrow();
  });

  it('rejette un mot au-dela de la duree utile', () => {
    const limite = 38 - EXIT_PADDING_FRAMES;
    expect(
      parseResolved(withWords({ text: 'a', startFrame: limite - 2, endFrame: limite }))?.captions,
    ).toHaveLength(1);
    expect(() =>
      parseResolved(withWords({ text: 'a', startFrame: limite - 2, endFrame: limite + 1 })),
    ).toThrow();
  });

  it('rejette des cues dans le desordre', () => {
    const captions = [cue(2, 10), cue(2)];
    expect(() => parseResolved({ ...statement, ...resolvedExtra, captions })).toThrow();
  });

  it('rejette un mot aux bornes invalides', () => {
    const captions = (word: unknown) => [{ words: [word] }];
    expect(() =>
      parseResolved({
        ...statement,
        ...resolvedExtra,
        captions: captions({ text: '', startFrame: 0, endFrame: 3 }),
      }),
    ).toThrow();
    expect(() =>
      parseResolved({
        ...statement,
        ...resolvedExtra,
        captions: captions({ text: 'a', startFrame: -1, endFrame: 3 }),
      }),
    ).toThrow();
    expect(() =>
      parseResolved({
        ...statement,
        ...resolvedExtra,
        captions: captions({ text: 'a', startFrame: 0, endFrame: 0 }),
      }),
    ).toThrow();
    expect(() =>
      parseResolved({
        ...statement,
        ...resolvedExtra,
        captions: captions({ text: 'a', startFrame: 0.5, endFrame: 3 }),
      }),
    ).toThrow();
  });
});

describe('timing pilote par audio', () => {
  it('arrondit la duree audio au superieur', () => {
    expect(audioDurationToFrames(1.0, FPS)).toBe(30 + EXIT_PADDING_FRAMES);
    expect(audioDurationToFrames(1.001, FPS)).toBe(31 + EXIT_PADDING_FRAMES);
    expect(audioDurationToFrames(2.999, FPS)).toBe(90 + EXIT_PADDING_FRAMES);
  });

  it('ajoute exactement le padding de sortie', () => {
    expect(EXIT_PADDING_FRAMES).toBe(8);
    expect(audioDurationToFrames(3, FPS) - Math.ceil(3 * FPS)).toBe(EXIT_PADDING_FRAMES);
  });

  it('produit toujours une duree positive', () => {
    expect(audioDurationToFrames(0.001, FPS)).toBeGreaterThan(0);
  });

  it('totalise les durees resolues', () => {
    const scenes: ResolvedScene[] = [38, 90, 105].map((durationInFrames) => ({
      type: 'statement' as const,
      text: 'Une idee.',
      narration: 'Une narration.',
      ...resolvedExtra,
      durationInFrames,
    }));
    expect(totalResolvedFrames(scenes)).toBe(233);
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

  it('porte une narration utile sur chaque scene', () => {
    for (const scene of demo.scenes) {
      expect(scene.narration.trim().length).toBeGreaterThan(0);
      expect(scene.narration.length).toBeLessThanOrEqual(300);
    }
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
  });

  it('rejette un prefixe trompeur', () => {
    expect(isPathInsideRoot('/p/assets', '/p/assets-prive/a.jpg', '/')).toBe(false);
    expect(isPathInsideRoot(root, `${root}2${WIN_SEP}a.jpg`, WIN_SEP)).toBe(false);
  });
});
