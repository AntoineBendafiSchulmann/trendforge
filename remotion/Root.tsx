import './index.css';
import { Composition } from 'remotion';
import { VERTICAL_9_16 } from '../src/config.ts';
import { totalResolvedFrames, type ResolvedVideoContent } from '../src/content.ts';
import { Video } from './Video.tsx';

const FALLBACK: ResolvedVideoContent = {
  scenes: [
    {
      type: 'statement',
      text: 'Lancer npm run generate',
      narration: 'Lancer npm run generate.',
      audioSrc: 'generated/audio/scene-01.wav',
      durationInFrames: VERTICAL_9_16.fps,
    },
  ],
};

export const RemotionRoot = () => (
  <Composition
    id="TrendForgeVideo"
    component={Video}
    defaultProps={FALLBACK}
    calculateMetadata={({ props }) => ({
      durationInFrames: totalResolvedFrames(props.scenes),
    })}
    fps={VERTICAL_9_16.fps}
    width={VERTICAL_9_16.width}
    height={VERTICAL_9_16.height}
  />
);
