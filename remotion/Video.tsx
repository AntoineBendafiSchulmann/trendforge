import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const Video = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0b0b0f',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ color: '#ffffff', fontFamily: 'sans-serif', fontSize: 96 }}>{frame}</span>
    </AbsoluteFill>
  );
};
