import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Media } from '../src/content.ts';

const ZOOM_PER_SECOND = 0.02;
const ZOOM_MAX = 1.25;

export const MediaBackground = ({
  media,
  durationInFrames,
}: {
  media: Media;
  durationInFrames: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const target = Math.min(1 + ZOOM_PER_SECOND * (durationInFrames / fps), ZOOM_MAX);
  const scale = interpolate(frame, [0, durationInFrames], [1, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <Img
        src={staticFile(media.src)}
        className="h-full w-full object-cover object-center"
        style={{ transform: `scale(${scale})` }}
      />
      <AbsoluteFill className="bg-black/45" />
      <AbsoluteFill className="bg-linear-to-b from-transparent via-black/35 to-transparent" />
    </AbsoluteFill>
  );
};
