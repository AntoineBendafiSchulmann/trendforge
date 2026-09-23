import { Audio } from '@remotion/media';
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { EXIT_PADDING_FRAMES, type Media, type ResolvedScene } from '../src/content.ts';
import { MediaBackground } from './MediaBackground.tsx';
import { ComparisonScene } from './scenes/ComparisonScene.tsx';
import { HookScene } from './scenes/HookScene.tsx';
import { StatementScene } from './scenes/StatementScene.tsx';
import { StatScene } from './scenes/StatScene.tsx';

const ENTER_FRAMES = 8;

const mediaOf = (scene: ResolvedScene): Media | undefined =>
  scene.type === 'hook' || scene.type === 'statement' ? scene.media : undefined;

const renderScene = (scene: ResolvedScene) => {
  switch (scene.type) {
    case 'hook':
      return <HookScene scene={scene} />;
    case 'statement':
      return <StatementScene scene={scene} />;
    case 'stat':
      return <StatScene scene={scene} />;
    case 'comparison':
      return <ComparisonScene scene={scene} />;
  }
};

export const Scene = ({
  scene,
  durationInFrames,
}: {
  scene: ResolvedScene;
  durationInFrames: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const media = mediaOf(scene);

  const lift = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 15 });
  const enter = interpolate(frame, [0, ENTER_FRAMES], [0, 1], { extrapolateRight: 'clamp' });
  const exit = interpolate(
    frame,
    [durationInFrames - EXIT_PADDING_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill className="items-center justify-center overflow-hidden px-16 pt-[12%] pb-[22%]">
      <Audio src={staticFile(scene.audioSrc)} />
      {media === undefined ? null : (
        <AbsoluteFill style={{ opacity: enter * exit }}>
          <MediaBackground media={media} durationInFrames={durationInFrames} />
        </AbsoluteFill>
      )}
      <div
        className="relative flex w-full max-w-[900px] flex-col items-center gap-8 text-center"
        style={{ opacity: enter * exit, transform: `translateY(${(1 - lift) * 40}px)` }}
      >
        {renderScene(scene)}
      </div>
    </AbsoluteFill>
  );
};
