import { z } from 'zod';
import { OUTRO_DURATION_FRAMES } from './config.ts';

export const EXIT_PADDING_FRAMES = 8;

const IMAGE_SRC_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.(?:jpe?g|png|webp)$/;
const VIDEO_SRC_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.mp4$/;
const AUDIO_SRC_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.wav$/;
const QUERY_PATTERN = /^[\p{L}\p{N} ,'’-]+$/u;
const QUERY_HAS_WORD = /[\p{L}\p{N}]/u;

const localImageSchema = z.strictObject({
  mode: z.literal('local'),
  type: z.literal('image'),
  src: z.string().min(1).max(200).regex(IMAGE_SRC_PATTERN),
});

const localVideoSchema = z.strictObject({
  mode: z.literal('local'),
  type: z.literal('video'),
  src: z.string().min(1).max(200).regex(VIDEO_SRC_PATTERN),
});

const localMediaSchema = z.discriminatedUnion('type', [localImageSchema, localVideoSchema]);

const searchMediaSchema = z.strictObject({
  mode: z.literal('search'),
  kind: z.enum(['image', 'video']),
  query: z.string().min(3).max(80).regex(QUERY_PATTERN).regex(QUERY_HAS_WORD),
});

const mediaSchema = z.discriminatedUnion('mode', [localMediaSchema, searchMediaSchema]);

const mediaField = { media: mediaSchema.optional() };

const narrationSchema = z.string().min(1).max(300).regex(/\S/);

const hookSceneSchema = z.strictObject({
  type: z.literal('hook'),
  kicker: z.string().min(1).max(24).optional(),
  text: z.string().min(1).max(70),
  narration: narrationSchema,
  ...mediaField,
});

const statementSceneSchema = z.strictObject({
  type: z.literal('statement'),
  text: z.string().min(1).max(90),
  subtext: z.string().min(1).max(140).optional(),
  narration: narrationSchema,
  ...mediaField,
});

const statSceneSchema = z.strictObject({
  type: z.literal('stat'),
  value: z.string().min(1).max(8),
  label: z.string().min(1).max(40),
  caption: z.string().min(1).max(90).optional(),
  narration: narrationSchema,
  ...mediaField,
});

const comparisonItemSchema = z.strictObject({
  label: z.string().min(1).max(24),
  value: z.string().min(1).max(14),
});

const comparisonSceneSchema = z.strictObject({
  type: z.literal('comparison'),
  label: z.string().min(1).max(40),
  items: z.tuple([comparisonItemSchema, comparisonItemSchema]),
  narration: narrationSchema,
  ...mediaField,
});

const sceneSchema = z.discriminatedUnion('type', [
  hookSceneSchema,
  statementSceneSchema,
  statSceneSchema,
  comparisonSceneSchema,
]);

export const videoContentSchema = z.strictObject({
  scenes: z.array(sceneSchema).min(1).max(20),
});

const timedWordSchema = z.strictObject({
  text: z.string().min(1).max(40),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
});

const captionCueSchema = z.strictObject({
  words: z.array(timedWordSchema).min(1).max(5),
});

const captionsAreOrdered = (scene: {
  captions: readonly CaptionCue[];
  durationInFrames: number;
}): boolean => {
  const lastFrame = scene.durationInFrames - EXIT_PADDING_FRAMES;
  let previousEnd = 0;

  for (const cue of scene.captions) {
    for (const word of cue.words) {
      if (word.endFrame <= word.startFrame) return false;
      if (word.startFrame < previousEnd) return false;
      if (word.endFrame > lastFrame) return false;
      previousEnd = word.endFrame;
    }
  }

  return true;
};

const resolvedFields = {
  audioSrc: z.string().min(1).max(200).regex(AUDIO_SRC_PATTERN),
  durationInFrames: z.number().int().positive(),
  captions: z.array(captionCueSchema).max(120),
};

const resolvedMediaField = { media: localMediaSchema.optional() };

const resolvedSceneSchema = z
  .discriminatedUnion('type', [
    hookSceneSchema.extend(resolvedFields).extend(resolvedMediaField),
    statementSceneSchema.extend(resolvedFields).extend(resolvedMediaField),
    statSceneSchema.extend(resolvedFields).extend(resolvedMediaField),
    comparisonSceneSchema.extend(resolvedFields).extend(resolvedMediaField),
  ])
  .refine(captionsAreOrdered, {
    message: 'sous-titres non ordonnes, en recouvrement ou hors des bornes de la scene',
  });

export const resolvedVideoContentSchema = z.strictObject({
  scenes: z.array(resolvedSceneSchema).min(1).max(20),
});

export type LocalMedia = z.infer<typeof localMediaSchema>;
export type SearchMedia = z.infer<typeof searchMediaSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type HookScene = z.infer<typeof hookSceneSchema>;
export type StatementScene = z.infer<typeof statementSceneSchema>;
export type StatScene = z.infer<typeof statSceneSchema>;
export type ComparisonScene = z.infer<typeof comparisonSceneSchema>;
export type ComparisonItem = z.infer<typeof comparisonItemSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type VideoContent = z.infer<typeof videoContentSchema>;
export type ResolvedScene = z.infer<typeof resolvedSceneSchema>;
export type ResolvedVideoContent = z.infer<typeof resolvedVideoContentSchema>;
export type TimedWord = z.infer<typeof timedWordSchema>;
export type CaptionCue = z.infer<typeof captionCueSchema>;

export const audioDurationToFrames = (seconds: number, fps: number): number =>
  Math.ceil(seconds * fps) + EXIT_PADDING_FRAMES;

// Toute composition TrendForge se termine par l'outro fixe.
export const totalResolvedFrames = (scenes: readonly ResolvedScene[]): number =>
  scenes.reduce((total, scene) => total + scene.durationInFrames, 0) + OUTRO_DURATION_FRAMES;

export const isPathInsideRoot = (root: string, candidate: string, separator: string): boolean =>
  candidate === root || candidate.startsWith(root + separator);
