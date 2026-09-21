import { interpolate, useCurrentFrame } from 'remotion';
import type { ComparisonItem, ComparisonScene as ComparisonSceneData } from '../../src/content.ts';

const REVEAL_FRAMES = 10;

const Item = ({ item, delay, frame }: { item: ComparisonItem; delay: number; frame: number }) => {
  const range: readonly [number, number] = [delay, delay + REVEAL_FRAMES];
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  return (
    <div
      className="flex w-full flex-col items-center gap-3"
      style={{
        opacity: interpolate(frame, range, [0, 1], clamp),
        transform: `translateY(${interpolate(frame, range, [24, 0], clamp)}px)`,
      }}
    >
      <span className="font-sans text-2xl font-semibold uppercase tracking-[0.25em] text-zinc-500">
        {item.label}
      </span>
      <span className="text-balance break-words font-sans text-6xl font-bold text-accent">
        {item.value}
      </span>
    </div>
  );
};

export const ComparisonScene = ({ scene }: { scene: ComparisonSceneData }) => {
  const frame = useCurrentFrame();
  const [first, second] = scene.items;

  return (
    <>
      <span className="text-balance break-words font-sans text-4xl font-semibold text-zinc-400">
        {scene.label}
      </span>
      <div className="flex w-full flex-col items-center gap-10">
        <Item item={first} delay={0} frame={frame} />
        <div className="h-px w-2/3 bg-zinc-800" />
        <Item item={second} delay={REVEAL_FRAMES} frame={frame} />
      </div>
    </>
  );
};
