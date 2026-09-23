import { interpolate, useCurrentFrame } from 'remotion';
import { activeCueIndex, activeWordIndex } from '../src/captions.ts';
import type { CaptionCue } from '../src/content.ts';

const CUE_ENTER_FRAMES = 5;
const WORD_FADE_FRAMES = 3;
const INACTIVE_OPACITY = 0.55;

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const Captions = ({ captions }: { captions: readonly CaptionCue[] }) => {
  const frame = useCurrentFrame();
  const index = activeCueIndex(captions, frame);
  const cue = index === null ? undefined : captions[index];

  if (cue === undefined) return null;

  const active = activeWordIndex(cue, frame);
  const since = frame - (cue.words[0]?.startFrame ?? 0);
  const enter = interpolate(since, [0, CUE_ENTER_FRAMES], [0, 1], CLAMP);

  return (
    <div
      className="absolute inset-x-[120px] top-[1220px] flex h-[280px] items-center justify-center"
      style={{ opacity: enter, transform: `translateY(${(1 - enter) * 10}px)` }}
    >
      <p className="max-w-[840px] text-center font-sans text-[48px] font-bold leading-[1.25] text-white text-shadow-[0_2px_10px_rgba(0,0,0,0.55)] [overflow-wrap:anywhere]">
        {cue.words.map((word, position) => (
          <span
            key={position}
            style={{
              opacity:
                position === active
                  ? interpolate(
                      frame - word.startFrame,
                      [0, WORD_FADE_FRAMES],
                      [INACTIVE_OPACITY, 1],
                      CLAMP,
                    )
                  : INACTIVE_OPACITY,
            }}
          >
            {position === 0 ? word.text : ` ${word.text}`}
          </span>
        ))}
      </p>
    </div>
  );
};
