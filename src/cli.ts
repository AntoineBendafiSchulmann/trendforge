import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { enableTailwind } from '@remotion/tailwind-v4';
import { videoContentSchema } from './content.ts';

const COMPOSITION_ID = 'TrendForgeVideo';
const ENTRY_POINT = path.resolve('remotion/index.ts');
const CONTENT_FILE = path.resolve('content/demo.json');
const OUTPUT_LOCATION = path.resolve('output/video-001.mp4');

const main = async (): Promise<void> => {
  const raw: unknown = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
  const inputProps = videoContentSchema.parse(raw);
  console.log(`Contenu... ${inputProps.scenes.length} scenes`);

  console.log('Navigateur...');
  await ensureBrowser();

  console.log('Bundle...');
  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    webpackOverride: enableTailwind,
  });

  console.log('Composition...');
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
  console.log(`Duree... ${composition.durationInFrames} frames`);

  console.log('Rendu...');
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: OUTPUT_LOCATION,
    inputProps,
  });

  console.log(OUTPUT_LOCATION);
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
