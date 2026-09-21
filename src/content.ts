import { z } from 'zod';

const durationSchema = z.number().min(0.6).max(30);

const MEDIA_SRC_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.(?:jpe?g|png|webp)$/;

const mediaSchema = z.strictObject({
  type: z.literal('image'),
  src: z.string().min(1).max(200).regex(MEDIA_SRC_PATTERN),
});

const hookSceneSchema = z.strictObject({
  type: z.literal('hook'),
  kicker: z.string().min(1).max(24).optional(),
  text: z.string().min(1).max(70),
  media: mediaSchema.optional(),
  durationInSeconds: durationSchema,
});

const statementSceneSchema = z.strictObject({
  type: z.literal('statement'),
  text: z.string().min(1).max(90),
  subtext: z.string().min(1).max(140).optional(),
  media: mediaSchema.optional(),
  durationInSeconds: durationSchema,
});

const statSceneSchema = z.strictObject({
  type: z.literal('stat'),
  value: z.string().min(1).max(8),
  label: z.string().min(1).max(40),
  caption: z.string().min(1).max(90).optional(),
  durationInSeconds: durationSchema,
});

const comparisonItemSchema = z.strictObject({
  label: z.string().min(1).max(24),
  value: z.string().min(1).max(14),
});

const comparisonSceneSchema = z.strictObject({
  type: z.literal('comparison'),
  label: z.string().min(1).max(40),
  items: z.tuple([comparisonItemSchema, comparisonItemSchema]),
  durationInSeconds: durationSchema,
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

export type Media = z.infer<typeof mediaSchema>;
export type HookScene = z.infer<typeof hookSceneSchema>;
export type StatementScene = z.infer<typeof statementSceneSchema>;
export type StatScene = z.infer<typeof statSceneSchema>;
export type ComparisonScene = z.infer<typeof comparisonSceneSchema>;
export type ComparisonItem = z.infer<typeof comparisonItemSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type VideoContent = z.infer<typeof videoContentSchema>;

export const secondsToFrames = (seconds: number, fps: number): number =>
  Math.max(1, Math.round(seconds * fps));

export const sceneDurationsInFrames = (scenes: readonly Scene[], fps: number): number[] =>
  scenes.map((scene) => secondsToFrames(scene.durationInSeconds, fps));

export const totalDurationInFrames = (scenes: readonly Scene[], fps: number): number =>
  sceneDurationsInFrames(scenes, fps).reduce((total, frames) => total + frames, 0);

export const isPathInsideRoot = (root: string, candidate: string, separator: string): boolean =>
  candidate === root || candidate.startsWith(root + separator);
