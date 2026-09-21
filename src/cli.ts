import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { enableTailwind } from '@remotion/tailwind-v4';
import { isPathInsideRoot, videoContentSchema, type Scene } from './content.ts';

const COMPOSITION_ID = 'TrendForgeVideo';
const ENTRY_POINT = path.resolve('remotion/index.ts');
const CONTENT_FILE = path.resolve('content/demo.json');
const ASSETS_DIR = path.resolve('assets');
const OUTPUT_LOCATION = path.resolve('output/video-001.mp4');

const mediaSrcOf = (scene: Scene): string | undefined =>
  scene.type === 'hook' || scene.type === 'statement' ? scene.media?.src : undefined;

const checkMedia = async (scenes: readonly Scene[]): Promise<number> => {
  let checked = 0;

  for (const [index, scene] of scenes.entries()) {
    const src = mediaSrcOf(scene);
    if (src === undefined) continue;

    const resolved = path.resolve(ASSETS_DIR, src);
    if (!isPathInsideRoot(ASSETS_DIR, resolved, path.sep)) {
      throw new Error(`Scene ${index} : media hors de assets/ (${src})`);
    }

    const info = await stat(resolved).catch(() => null);
    if (info === null) {
      throw new Error(`Scene ${index} : media introuvable (${src}) -> ${resolved}`);
    }
    if (!info.isFile()) {
      throw new Error(`Scene ${index} : media n'est pas un fichier (${src})`);
    }
    if (info.size === 0) {
      throw new Error(`Scene ${index} : media vide (${src})`);
    }

    checked += 1;
  }

  return checked;
};

const main = async (): Promise<void> => {
  const raw: unknown = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
  const inputProps = videoContentSchema.parse(raw);
  console.log(`Contenu... ${inputProps.scenes.length} scenes`);

  console.log(`Medias... ${await checkMedia(inputProps.scenes)} verifies`);

  console.log('Navigateur...');
  await ensureBrowser();

  console.log('Bundle...');
  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    webpackOverride: enableTailwind,
    publicDir: ASSETS_DIR,
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
