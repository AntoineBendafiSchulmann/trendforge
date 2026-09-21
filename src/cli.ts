import { VERTICAL_9_16 } from './config.ts';

const main = (): void => {
  const { width, height, fps } = VERTICAL_9_16;

  console.log('TrendForge');
  console.log(`Node         : ${process.version}`);
  console.log(`Format cible : ${width}x${height} @ ${fps} fps`);
  console.log('Pipeline     : pas encore implemente.');
};

main();
