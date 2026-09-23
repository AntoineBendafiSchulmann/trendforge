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

export const MEDIA_BACKGROUND_MAX_ZOOM = 1.05;

export const OUTRO_DURATION_FRAMES = 75;
export const OUTRO_ENTER_FRAMES = 8;
export const OUTRO_FADE_OUT_FRAMES = 15;

const ratio = (value: number, span: number): number =>
  span <= 0 ? 1 : Math.min(Math.max(value / span, 0), 1);

export const imageZoomScale = (frame: number, durationInFrames: number): number =>
  1 + (MEDIA_BACKGROUND_MAX_ZOOM - 1) * ratio(frame, durationInFrames);

export const outroOpacity = (frame: number, durationInFrames: number): number => {
  const lastFrame = durationInFrames - 1;
  const appearance = ratio(frame, OUTRO_ENTER_FRAMES);
  const disappearance =
    1 - ratio(frame - (lastFrame - OUTRO_FADE_OUT_FRAMES), OUTRO_FADE_OUT_FRAMES);
  return Math.min(appearance, disappearance);
};
