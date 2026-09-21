import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Scene as SceneData } from '../src/content.ts';

export const Scene = ({ scene }: { scene: SceneData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 15 });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill className="items-center justify-center px-16 text-center">
      <div
        className="flex flex-col items-center gap-8"
        style={{ opacity, transform: `translateY(${(1 - enter) * 40}px)` }}
      >
        <span className="text-balance font-sans text-7xl font-bold leading-tight text-white">
          {scene.text}
        </span>
        {scene.subtext === undefined ? null : (
          <span className="text-balance font-sans text-3xl text-zinc-400">{scene.subtext}</span>
        )}
      </div>
    </AbsoluteFill>
  );
};
