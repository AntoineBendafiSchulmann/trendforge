import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { OUTRO_DURATION_FRAMES, outroOpacity } from '../src/config.ts';

// Brique visuelle fixe de TrendForge : aucun contenu editorial ne la configure.
const CTA = 'Abonne-toi pour la suite';
const THUMB = '\u{1F44D}';

export const Outro = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill className="items-center justify-center bg-black px-16">
      <div
        className="flex flex-col items-center gap-14"
        style={{ opacity: outroOpacity(frame, OUTRO_DURATION_FRAMES) }}
      >
        <span className="text-balance break-words text-center font-sans text-7xl font-black leading-tight tracking-tight text-white">
          {CTA}
        </span>
        <span className="text-6xl leading-none">{THUMB}</span>
      </div>
    </AbsoluteFill>
  );
};
