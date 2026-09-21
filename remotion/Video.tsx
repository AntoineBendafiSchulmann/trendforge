import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const Video = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill className="items-center justify-center bg-zinc-950">
      <span className="font-sans text-8xl text-white">{frame}</span>
    </AbsoluteFill>
  );
};
