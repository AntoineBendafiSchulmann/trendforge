import { z } from 'zod';

export const sceneSchema = z.object({
  text: z.string().min(1),
  subtext: z.string().min(1).optional(),
  durationInSeconds: z.number().positive().max(30),
});

export const videoContentSchema = z.object({
  scenes: z.array(sceneSchema).min(1).max(20),
});

export type Scene = z.infer<typeof sceneSchema>;
export type VideoContent = z.infer<typeof videoContentSchema>;

export const secondsToFrames = (seconds: number, fps: number): number =>
  Math.max(1, Math.round(seconds * fps));

export const sceneDurationsInFrames = (scenes: readonly Scene[], fps: number): number[] =>
  scenes.map((scene) => secondsToFrames(scene.durationInSeconds, fps));

export const totalDurationInFrames = (scenes: readonly Scene[], fps: number): number =>
  sceneDurationsInFrames(scenes, fps).reduce((total, frames) => total + frames, 0);
