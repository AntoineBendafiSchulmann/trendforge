import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import type { Media } from '../src/content.ts';

const ZOOM_TO = 1.06;

export const MediaBackground = ({
  media,
  durationInFrames,
}: {
  media: Media;
  durationInFrames: number;
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [1, ZOOM_TO], {
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
