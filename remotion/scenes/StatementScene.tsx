import type { StatementScene as StatementSceneData } from '../../src/content.ts';

export const StatementScene = ({ scene }: { scene: StatementSceneData }) => (
  <>
    <span className="text-balance break-words font-sans text-6xl font-bold leading-tight text-white">
      {scene.text}
    </span>
    {scene.subtext === undefined ? null : (
      <span className="text-balance break-words font-sans text-3xl leading-snug text-zinc-400">
        {scene.subtext}
      </span>
    )}
  </>
);
