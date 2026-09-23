import { Video } from '@remotion/media';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { imageZoomScale } from '../src/config.ts';
import type { LocalMedia } from '../src/content.ts';

const ImageLayer = ({ src, durationInFrames }: { src: string; durationInFrames: number }) => {
  const frame = useCurrentFrame();

  return (
    <Img
      src={staticFile(src)}
      className="h-full w-full object-cover object-center"
      style={{ transform: `scale(${imageZoomScale(frame, durationInFrames)})` }}
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
    <AbsoluteFill className="bg-linear-to-b from-transparent via-black/45 to-black/65" />
  </AbsoluteFill>
);
