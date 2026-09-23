import { describe, expect, it } from 'vitest';
import alignmentFixture from './fixtures/alignment-fr.json' with { type: 'json' };
import { buildCaptions, narrationWords, piperSynthesisSchema } from '../src/captions.ts';
import { audioDurationToFrames, EXIT_PADDING_FRAMES } from '../src/content.ts';

const FPS = 30;
const SAMPLE_RATE = 22050;
const CHUNK = SAMPLE_RATE / 10;

const fixture = piperSynthesisSchema.parse(alignmentFixture);
const FIXTURE_TEXT = "L'été à Genève, c'est déjà l'idée.";

type Alignment = { phoneme: string; numSamples: number };

const synthesize = (groupSizes: readonly number[], separators: readonly number[] = []) => {
  const alignments: Alignment[] = [{ phoneme: '^', numSamples: CHUNK }];

  groupSizes.forEach((size, index) => {
    if (index > 0) {
      alignments.push({ phoneme: ' ', numSamples: (separators[index - 1] ?? 1) * CHUNK });
    }
    for (let phoneme = 0; phoneme < size; phoneme += 1) {
      alignments.push({ phoneme: 'a', numSamples: CHUNK });
    }
  });

  alignments.push({ phoneme: '$', numSamples: CHUNK });
  return { sampleRate: SAMPLE_RATE, alignments };
};

const build = (
  narration: string,
  groupSizes: readonly number[],
  separators: readonly number[] = [],
) => {
  const synthesis = synthesize(groupSizes, separators);
  const samples = synthesis.alignments.reduce((total, item) => total + item.numSamples, 0);

  return buildCaptions({
    narration,
    synthesis,
    fps: FPS,
    durationInFrames: audioDurationToFrames(samples / SAMPLE_RATE, FPS),
  });
};

const flatten = (result: ReturnType<typeof build>) => result.cues.flatMap((cue) => cue.words);

describe('contrat du provider Piper', () => {
  it('accepte la fixture reelle', () => {
    expect(fixture.sampleRate).toBe(SAMPLE_RATE);
    expect(fixture.alignments.length).toBeGreaterThan(0);
  });

  it('rejette un sampleRate non entier positif', () => {
    expect(() =>
      piperSynthesisSchema.parse({ sampleRate: 0, alignments: fixture.alignments }),
    ).toThrow();
    expect(() =>
      piperSynthesisSchema.parse({ sampleRate: 22050.5, alignments: fixture.alignments }),
    ).toThrow();
  });

  it('rejette une liste vide ou malformee', () => {
    expect(() => piperSynthesisSchema.parse({ sampleRate: SAMPLE_RATE, alignments: [] })).toThrow();
    expect(() =>
      piperSynthesisSchema.parse({ sampleRate: SAMPLE_RATE, alignments: [{ phoneme: 'a' }] }),
    ).toThrow();
    expect(() =>
      piperSynthesisSchema.parse({
        sampleRate: SAMPLE_RATE,
        alignments: [{ phoneme: 'a', numSamples: -1 }],
      }),
    ).toThrow();
  });
});

describe('tokenisation de la narration', () => {
  it('garde les mots accentues, elides et apostrophes', () => {
    expect(narrationWords(FIXTURE_TEXT)).toEqual([
      "L'été",
      'à',
      'Genève,',
      "c'est",
      'déjà',
      "l'idée.",
    ]);
  });

  it('ignore un token de ponctuation isole', () => {
    expect(narrationWords('Imaginez : au lieu')).toEqual(['Imaginez', 'au', 'lieu']);
    expect(narrationWords('Vraiment ? Oui !')).toEqual(['Vraiment', 'Oui']);
  });

  it('conserve les mots repetes', () => {
    expect(narrationWords('la ville, la ville')).toEqual(['la', 'ville,', 'la', 'ville']);
  });

  it('ne rend aucun mot pour une narration sans alphanumerique', () => {
    expect(narrationWords('... ? !')).toEqual([]);
  });
});

describe('alignement sur la fixture reelle', () => {
  const samples = fixture.alignments.reduce((total, item) => total + item.numSamples, 0);
  const durationInFrames = audioDurationToFrames(samples / SAMPLE_RATE, FPS);
  const result = buildCaptions({
    narration: FIXTURE_TEXT,
    synthesis: fixture,
    fps: FPS,
    durationInFrames,
  });
  const words = flatten(result);

  it('resout les six mots sans fallback', () => {
    expect(result.skipped).toBeNull();
    expect(words.map((word) => word.text)).toEqual(narrationWords(FIXTURE_TEXT));
  });

  it('exclut les silences BOS et EOS des mots', () => {
    expect(words[0]?.startFrame).toBeGreaterThan(0);
    expect(words.at(-1)?.endFrame).toBeLessThan(durationInFrames - EXIT_PADDING_FRAMES);
  });

  it('produit une timeline monotone sans recouvrement', () => {
    for (const [index, word] of words.entries()) {
      expect(word.endFrame).toBeGreaterThan(word.startFrame);
      const next = words[index + 1];
      if (next !== undefined) expect(next.startFrame).toBeGreaterThanOrEqual(word.endFrame);
    }
  });

  it('reste dans les bornes de la scene', () => {
    expect(words[0]?.startFrame).toBeGreaterThanOrEqual(0);
    for (const word of words) {
      expect(word.endFrame).toBeLessThanOrEqual(durationInFrames - EXIT_PADDING_FRAMES);
    }
  });
});

describe('conversion samples vers frames', () => {
  it('arrondit chaque frontiere depuis le sample absolu', () => {
    const words = flatten(build('un deux', [2, 2]));
    expect(words[0]).toEqual({ text: 'un', startFrame: 3, endFrame: 9 });
    expect(words[1]).toEqual({ text: 'deux', startFrame: 12, endFrame: 18 });
  });

  it('n accumule pas d erreur sur une longue phrase', () => {
    const words = flatten(
      build(
        'a b c d e f g h',
        Array.from({ length: 8 }, () => 1),
      ),
    );
    expect(words[7]).toEqual({ text: 'h', startFrame: 45, endFrame: 48 });
  });

  it('garantit au moins une frame par mot', () => {
    const synthesis = {
      sampleRate: SAMPLE_RATE,
      alignments: [
        { phoneme: '^', numSamples: CHUNK },
        { phoneme: 'a', numSamples: 10 },
        { phoneme: ' ', numSamples: 10 },
        { phoneme: 'b', numSamples: 10 },
        { phoneme: '$', numSamples: CHUNK },
      ],
    };
    const words = flatten(
      buildCaptions({ narration: 'un deux', synthesis, fps: FPS, durationInFrames: 40 }),
    );
    for (const word of words) expect(word.endFrame).toBeGreaterThan(word.startFrame);
    expect(words[1]?.startFrame).toBeGreaterThanOrEqual(words[0]?.endFrame ?? 0);
  });
});

describe('regroupement en cues', () => {
  it('limite chaque cue a cinq mots', () => {
    const result = build(
      'un deux trois quatre cinq six sept',
      Array.from({ length: 7 }, () => 1),
    );
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0]?.words).toHaveLength(5);
    expect(result.cues[1]?.words).toHaveLength(2);
  });

  it('ne produit jamais de cue vide', () => {
    const result = build('un deux trois', [1, 1, 1]);
    for (const cue of result.cues) expect(cue.words.length).toBeGreaterThan(0);
  });

  it.each([
    ['virgule', 'un, deux trois'],
    ['point', 'un. deux trois'],
    ['interrogation', 'un? deux trois'],
    ['exclamation', 'un! deux trois'],
    ['deux-points', 'un: deux trois'],
    ['point-virgule', 'un; deux trois'],
  ])('coupe apres une %s attachee au mot', (_nom, narration) => {
    const result = build(narration, [1, 1, 1]);
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0]?.words).toHaveLength(1);
    expect(result.cues[1]?.words.map((word) => word.text)).toEqual(['deux', 'trois']);
  });

  it('conserve la ponctuation dans le texte du mot', () => {
    const words = flatten(build('un, deux trois', [1, 1, 1]));
    expect(words.map((word) => word.text)).toEqual(['un,', 'deux', 'trois']);
  });

  it('ne coupe que tous les cinq mots sans ponctuation', () => {
    const result = build(
      'un deux trois quatre cinq six sept',
      Array.from({ length: 7 }, () => 1),
    );
    expect(result.cues.map((cue) => cue.words.length)).toEqual([5, 2]);
  });

  it('ne coupe pas sur une ponctuation detachee, absente des mots', () => {
    const result = build('un : deux trois', [1, 1, 1]);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0]?.words.map((word) => word.text)).toEqual(['un', 'deux', 'trois']);
  });

  it('ne depend pas du timing entre les mots', () => {
    const serre = build('un, deux trois', [1, 1, 1], [1, 1]);
    const espace = build('un, deux trois', [1, 1, 1], [9, 9]);
    expect(serre.cues.map((cue) => cue.words.length)).toEqual(
      espace.cues.map((cue) => cue.words.length),
    );
  });

  it('conserve l ordre des mots', () => {
    const words = flatten(build('la ville, la ville', [1, 1, 1, 1]));
    expect(words.map((word) => word.text)).toEqual(['la', 'ville,', 'la', 'ville']);
  });
});

describe('mapping ambigu : aucun timestamp fabrique', () => {
  it('retombe en fallback quand les groupes ne correspondent pas', () => {
    const result = build('un deux trois', [1, 1]);
    expect(result.cues).toEqual([]);
    expect(result.skipped).toContain('groupes phonemiques');
  });

  it('retombe en fallback sur une narration sans mot', () => {
    expect(build('... ?', [1]).skipped).toBe('narration sans mot prononcable');
  });

  it.each([
    ['3', 1],
    ['1 200', 2],
    ['10 km', 2],
  ])('resout %s (%i groupes observes chez Piper)', (narration, groups) => {
    const result = build(
      narration,
      Array.from({ length: groups }, () => 1),
    );
    expect(result.skipped).toBeNull();
    expect(flatten(result)).toHaveLength(narrationWords(narration).length);
  });

  it.each([
    ['3,5 %', 4],
    ['2026', 3],
  ])('refuse %s que Piper prononce en %i groupes', (narration, groups) => {
    const result = build(
      narration,
      Array.from({ length: groups }, () => 1),
    );
    expect(result.cues).toEqual([]);
    expect(result.skipped).toContain('groupes phonemiques');
  });
});

describe('bornes de scene', () => {
  it('refuse une timeline qui depasse la fin audio', () => {
    const synthesis = synthesize([2, 2]);
    const result = buildCaptions({
      narration: 'un deux',
      synthesis,
      fps: FPS,
      durationInFrames: EXIT_PADDING_FRAMES + 5,
    });
    expect(result.cues).toEqual([]);
    expect(result.skipped).toBe('timeline hors des bornes de la scene');
  });
});
