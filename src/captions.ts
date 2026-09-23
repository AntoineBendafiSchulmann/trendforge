import { z } from 'zod';
import { EXIT_PADDING_FRAMES, type CaptionCue, type TimedWord } from './content.ts';

const BOS = '^';
const EOS = '$';
const WORD_SEPARATOR = ' ';
const WORD_PATTERN = /[\p{L}\p{N}]/u;

const MAX_WORDS_PER_CUE = 5;
const CUE_BREAK_PATTERN = /[,.?!:;]$/;

const phonemeAlignmentSchema = z.strictObject({
  phoneme: z.string(),
  numSamples: z.number().int().nonnegative(),
});

export const piperSynthesisSchema = z.strictObject({
  sampleRate: z.number().int().positive(),
  alignments: z.array(phonemeAlignmentSchema).min(1),
});

export type PiperSynthesis = z.infer<typeof piperSynthesisSchema>;
export type CaptionResult = { cues: CaptionCue[]; skipped: string | null };

type Span = { startSample: number; endSample: number };

export const narrationWords = (narration: string): string[] =>
  narration.split(/\s+/).filter((token) => WORD_PATTERN.test(token));

export const phonemeGroups = (alignments: PiperSynthesis['alignments']): Span[] => {
  const groups: Span[] = [];
  let sample = 0;
  let current: Span | null = null;

  for (const { phoneme, numSamples } of alignments) {
    const start = sample;
    sample += numSamples;

    if (phoneme === WORD_SEPARATOR || phoneme === BOS || phoneme === EOS) {
      current = null;
      continue;
    }

    if (current === null) {
      current = { startSample: start, endSample: sample };
      groups.push(current);
    } else {
      current.endSample = sample;
    }
  }

  return groups;
};

const toFrame = (sample: number, sampleRate: number, fps: number): number =>
  Math.round((sample / sampleRate) * fps);

const timedWords = (
  words: readonly string[],
  groups: readonly Span[],
  sampleRate: number,
  fps: number,
  lastFrame: number,
): TimedWord[] | null => {
  const timed: TimedWord[] = [];
  let previousEnd = 0;

  for (const [index, text] of words.entries()) {
    const group = groups[index];
    if (group === undefined) return null;

    const startFrame = Math.max(toFrame(group.startSample, sampleRate, fps), previousEnd);
    const endFrame = Math.max(toFrame(group.endSample, sampleRate, fps), startFrame + 1);
    if (endFrame > lastFrame) return null;

    timed.push({ text, startFrame, endFrame });
    previousEnd = endFrame;
  }

  return timed;
};

const toCues = (words: readonly TimedWord[]): CaptionCue[] => {
  const cues: CaptionCue[] = [];
  let current: TimedWord[] = [];

  for (const word of words) {
    const previous = current.at(-1);
    const breaks =
      current.length === MAX_WORDS_PER_CUE ||
      (previous !== undefined && CUE_BREAK_PATTERN.test(previous.text));

    if (breaks) {
      cues.push({ words: current });
      current = [];
    }

    current.push(word);
  }

  if (current.length > 0) cues.push({ words: current });

  return cues;
};

export const buildCaptions = (input: {
  narration: string;
  synthesis: PiperSynthesis;
  fps: number;
  durationInFrames: number;
}): CaptionResult => {
  const words = narrationWords(input.narration);
  if (words.length === 0) return { cues: [], skipped: 'narration sans mot prononcable' };

  const groups = phonemeGroups(input.synthesis.alignments);
  if (groups.length !== words.length) {
    return {
      cues: [],
      skipped: `${words.length} mots pour ${groups.length} groupes phonemiques`,
    };
  }

  const timed = timedWords(
    words,
    groups,
    input.synthesis.sampleRate,
    input.fps,
    input.durationInFrames - EXIT_PADDING_FRAMES,
  );
  if (timed === null) return { cues: [], skipped: 'timeline hors des bornes de la scene' };

  return { cues: toCues(timed), skipped: null };
};
