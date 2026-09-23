import { Video } from '@remotion/media';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { MEDIA_BACKGROUND_MAX_ZOOM } from '../src/config.ts';
import type { LocalMedia } from '../src/content.ts';

const ZOOM_PER_SECOND = 0.02;

const ImageLayer = ({ src, durationInFrames }: { src: string; durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const target = Math.min(
    1 + ZOOM_PER_SECOND * (durationInFrames / fps),
    MEDIA_BACKGROUND_MAX_ZOOM,
  );
  const scale = interpolate(frame, [0, durationInFrames], [1, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Img
      src={staticFile(src)}
      className="h-full w-full object-cover object-center"
      style={{ transform: `scale(${scale})` }}
    />
  );
};

export const MediaBackground = ({
  media,
  durationInFrames,
}: {
  media: LocalMedia;
  durationInFrames: number;
}) => (
  <AbsoluteFill>
    {media.type === 'image' ? (
      <ImageLayer src={media.src} durationInFrames={durationInFrames} />
    ) : (
      <Video src={staticFile(media.src)} objectFit="cover" loop muted className="h-full w-full" />
    )}
    <AbsoluteFill className="bg-black/45" />
    <AbsoluteFill className="bg-linear-to-b from-transparent via-black/35 to-transparent" />
  </AbsoluteFill>
);
