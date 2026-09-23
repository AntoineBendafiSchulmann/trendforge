import { AbsoluteFill, Series } from 'remotion';
import { OUTRO_DURATION_FRAMES } from '../src/config.ts';
import type { ResolvedVideoContent } from '../src/content.ts';
import { Outro } from './Outro.tsx';
import { Scene } from './Scene.tsx';

export const Video = ({ scenes }: ResolvedVideoContent) => (
  <AbsoluteFill className="bg-zinc-950">
    <Series>
      {scenes.map((scene, index) => (
        <Series.Sequence key={index} durationInFrames={scene.durationInFrames}>
          <Scene scene={scene} durationInFrames={scene.durationInFrames} />
        </Series.Sequence>
      ))}
      <Series.Sequence durationInFrames={OUTRO_DURATION_FRAMES}>
        <Outro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
