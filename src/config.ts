import { z } from 'zod';

export const videoFormatSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
});

export type VideoFormat = z.infer<typeof videoFormatSchema>;

export const VERTICAL_9_16: VideoFormat = videoFormatSchema.parse({
  width: 1080,
  height: 1920,
  fps: 30,
});

export const MEDIA_BACKGROUND_MAX_ZOOM = 1.25;
