import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { enableTailwind } from '@remotion/tailwind-v4';

const COMPOSITION_ID = 'TrendForgeVideo';
const ENTRY_POINT = path.resolve('remotion/index.ts');
const OUTPUT_LOCATION = path.resolve('output/video-001.mp4');

const main = async (): Promise<void> => {
  console.log('Navigateur...');
  await ensureBrowser();

  console.log('Bundle...');
  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    webpackOverride: enableTailwind,
  });

  console.log('Composition...');
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID });

  console.log('Rendu...');
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: OUTPUT_LOCATION,
  });

  console.log(OUTPUT_LOCATION);
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
