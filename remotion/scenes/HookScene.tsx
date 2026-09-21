import type { HookScene as HookSceneData } from '../../src/content.ts';

export const HookScene = ({ scene }: { scene: HookSceneData }) => (
  <>
    {scene.kicker === undefined ? null : (
      <span className="font-sans text-3xl font-semibold tracking-[0.35em] text-accent">
        {scene.kicker}
      </span>
    )}
    <span className="text-balance break-words font-sans text-8xl font-black leading-[1.05] tracking-tight text-white">
      {scene.text}
    </span>
  </>
);
