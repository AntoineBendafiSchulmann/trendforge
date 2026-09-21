import './index.css';
import { Composition } from 'remotion';
import demoContent from '../content/demo.json' with { type: 'json' };
import { VERTICAL_9_16 } from '../src/config.ts';
import { totalDurationInFrames, videoContentSchema } from '../src/content.ts';
import { Video } from './Video.tsx';

const demo = videoContentSchema.parse(demoContent);

export const RemotionRoot = () => (
  <Composition
    id="TrendForgeVideo"
    component={Video}
    defaultProps={demo}
    calculateMetadata={({ props }) => ({
      durationInFrames: totalDurationInFrames(props.scenes, VERTICAL_9_16.fps),
    })}
    fps={VERTICAL_9_16.fps}
    width={VERTICAL_9_16.width}
    height={VERTICAL_9_16.height}
  />
);
