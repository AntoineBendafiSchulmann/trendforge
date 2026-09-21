import { AbsoluteFill, Series, useVideoConfig } from 'remotion';
import { secondsToFrames, type VideoContent } from '../src/content.ts';
import { Scene } from './Scene.tsx';

export const Video = ({ scenes }: VideoContent) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill className="bg-zinc-950">
      <Series>
        {scenes.map((scene, index) => {
          const durationInFrames = secondsToFrames(scene.durationInSeconds, fps);

          return (
            <Series.Sequence key={index} durationInFrames={durationInFrames}>
              <Scene scene={scene} durationInFrames={durationInFrames} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
