import { describe, expect, it } from 'vitest';
import { MEDIA_BACKGROUND_MAX_ZOOM, VERTICAL_9_16, videoFormatSchema } from '../src/config.ts';

describe('videoFormatSchema', () => {
  it('accepte le format vertical 1080x1920 @30fps', () => {
    expect(videoFormatSchema.parse(VERTICAL_9_16)).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
    });
  });

  it('rejette une dimension non entiere', () => {
    expect(() => videoFormatSchema.parse({ width: 1080.5, height: 1920, fps: 30 })).toThrow();
  });

  it('rejette une valeur negative', () => {
    expect(() => videoFormatSchema.parse({ width: 1080, height: -1920, fps: 30 })).toThrow();
  });
});

describe('MEDIA_BACKGROUND_MAX_ZOOM', () => {
  it('agrandit le media et impose une source 1350x2400 minimum', () => {
    expect(MEDIA_BACKGROUND_MAX_ZOOM).toBeGreaterThan(1);
    expect(VERTICAL_9_16.width * MEDIA_BACKGROUND_MAX_ZOOM).toBe(1350);
    expect(VERTICAL_9_16.height * MEDIA_BACKGROUND_MAX_ZOOM).toBe(2400);
  });
});
