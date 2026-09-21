import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StatScene as StatSceneData } from '../../src/content.ts';

export const StatScene = ({ scene }: { scene: StatSceneData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6 },
    durationInFrames: 20,
    delay: 4,
  });

  return (
    <>
      <span
        className="font-sans text-[220px] font-black leading-none tracking-tight text-accent"
        style={{ transform: `scale(${0.85 + pop * 0.15})` }}
      >
        {scene.value}
      </span>
      <span className="text-balance break-words font-sans text-4xl font-semibold leading-snug text-white">
        {scene.label}
      </span>
      {scene.caption === undefined ? null : (
        <span className="text-balance break-words font-sans text-2xl leading-snug text-zinc-500">
          {scene.caption}
        </span>
      )}
    </>
  );
};
