import { z } from 'zod';

export const EXIT_PADDING_FRAMES = 8;

const MEDIA_SRC_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.(?:jpe?g|png|webp)$/;
const AUDIO_SRC_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.wav$/;

const mediaSchema = z.strictObject({
  type: z.literal('image'),
  src: z.string().min(1).max(200).regex(MEDIA_SRC_PATTERN),
});

const narrationSchema = z.string().min(1).max(300).regex(/\S/);

const hookSceneSchema = z.strictObject({
  type: z.literal('hook'),
  kicker: z.string().min(1).max(24).optional(),
  text: z.string().min(1).max(70),
  narration: narrationSchema,
  media: mediaSchema.optional(),
});

const statementSceneSchema = z.strictObject({
  type: z.literal('statement'),
  text: z.string().min(1).max(90),
  subtext: z.string().min(1).max(140).optional(),
  narration: narrationSchema,
  media: mediaSchema.optional(),
});

const statSceneSchema = z.strictObject({
  type: z.literal('stat'),
  value: z.string().min(1).max(8),
  label: z.string().min(1).max(40),
  caption: z.string().min(1).max(90).optional(),
  narration: narrationSchema,
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

const resolvedFields = {
  audioSrc: z.string().min(1).max(200).regex(AUDIO_SRC_PATTERN),
  durationInFrames: z.number().int().positive(),
};

const resolvedSceneSchema = z.discriminatedUnion('type', [
  hookSceneSchema.extend(resolvedFields),
  statementSceneSchema.extend(resolvedFields),
  statSceneSchema.extend(resolvedFields),
  comparisonSceneSchema.extend(resolvedFields),
]);

export const resolvedVideoContentSchema = z.strictObject({
  scenes: z.array(resolvedSceneSchema).min(1).max(20),
});

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

export const audioDurationToFrames = (seconds: number, fps: number): number =>
  Math.ceil(seconds * fps) + EXIT_PADDING_FRAMES;

export const totalResolvedFrames = (scenes: readonly ResolvedScene[]): number =>
  scenes.reduce((total, scene) => total + scene.durationInFrames, 0);

export const isPathInsideRoot = (root: string, candidate: string, separator: string): boolean =>
  candidate === root || candidate.startsWith(root + separator);
