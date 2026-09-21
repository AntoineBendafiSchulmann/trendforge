import './index.css';
import { Composition } from 'remotion';
import { VERTICAL_9_16 } from '../src/config.ts';
import { Video } from './Video.tsx';

export const RemotionRoot = () => (
  <Composition
    id="TrendForgeVideo"
    component={Video}
    durationInFrames={VERTICAL_9_16.fps * 5}
    fps={VERTICAL_9_16.fps}
    width={VERTICAL_9_16.width}
    height={VERTICAL_9_16.height}
  />
);
