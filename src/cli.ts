import { mkdir, rm, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { enableTailwind } from '@remotion/tailwind-v4';
import { VERTICAL_9_16 } from './config.ts';
import {
  audioDurationToFrames,
  isPathInsideRoot,
  totalResolvedFrames,
  videoContentSchema,
  type ResolvedScene,
  type Scene,
} from './content.ts';
import { audioDurationInSeconds, ensureTooling, normalizeLoudness, speak } from './tts.ts';

const COMPOSITION_ID = 'TrendForgeVideo';
const ENTRY_POINT = path.resolve('remotion/index.ts');
const CONTENT_FILE = path.resolve('content/demo.json');
const ASSETS_DIR = path.resolve('assets');
const AUDIO_DIR = path.resolve('assets/generated/audio');
const OUTPUT_LOCATION = path.resolve('output/video-001.mp4');

const mediaSrcOf = (scene: Scene): string | undefined =>
  scene.type === 'hook' || scene.type === 'statement' ? scene.media?.src : undefined;

const inScene = async <T>(index: number, step: string, task: () => Promise<T>): Promise<T> => {
  try {
    return await task();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Scene ${index + 1} (${step}) : ${detail}`, { cause: error });
  }
};

const checkMedia = async (scenes: readonly Scene[]): Promise<number> => {
  let checked = 0;

  for (const [index, scene] of scenes.entries()) {
    const src = mediaSrcOf(scene);
    if (src === undefined) continue;

    const resolved = path.resolve(ASSETS_DIR, src);
    if (!isPathInsideRoot(ASSETS_DIR, resolved, path.sep)) {
      throw new Error(`Scene ${index + 1} : media hors de assets/ (${src})`);
    }

    const info = await stat(resolved).catch(() => null);
    if (info === null) {
      throw new Error(`Scene ${index + 1} : media introuvable (${src}) -> ${resolved}`);
    }
    if (!info.isFile()) {
      throw new Error(`Scene ${index + 1} : media n'est pas un fichier (${src})`);
    }
    if (info.size === 0) {
      throw new Error(`Scene ${index + 1} : media vide (${src})`);
    }

    checked += 1;
  }

  return checked;
};

const narrate = async (scenes: readonly Scene[]): Promise<ResolvedScene[]> => {
  await rm(AUDIO_DIR, { recursive: true, force: true });
  await mkdir(AUDIO_DIR, { recursive: true });

  const resolved: ResolvedScene[] = [];

  for (const [index, scene] of scenes.entries()) {
    const name = `scene-${String(index + 1).padStart(2, '0')}.wav`;
    const rawPath = path.join(AUDIO_DIR, `${name}.raw`);
    const finalPath = path.join(AUDIO_DIR, name);

    await inScene(index, 'synthese', async () => {
      await speak(scene.narration, rawPath);
      const info = await stat(rawPath).catch(() => null);
      if (info === null || !info.isFile()) throw new Error("Piper n'a produit aucun fichier");
      if (info.size === 0) throw new Error('Piper a produit un fichier vide');
    });

    await inScene(index, 'normalisation', async () => {
      await normalizeLoudness(rawPath, finalPath);
      await rm(rawPath, { force: true });
      const info = await stat(finalPath).catch(() => null);
      if (info === null || info.size === 0) throw new Error('WAV normalise absent ou vide');
    });

    const seconds = await inScene(index, 'mesure', () => audioDurationInSeconds(finalPath));

    resolved.push({
      ...scene,
      audioSrc: `generated/audio/${name}`,
      durationInFrames: audioDurationToFrames(seconds, VERTICAL_9_16.fps),
    });
  }

  return resolved;
};

const main = async (): Promise<void> => {
  const raw: unknown = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
  const content = videoContentSchema.parse(raw);
  console.log(`Contenu... ${content.scenes.length} scenes`);

  console.log(`Medias... ${await checkMedia(content.scenes)} verifies`);

  console.log('Outils...');
  await ensureTooling();

  console.log('Narration...');
  const scenes = await narrate(content.scenes);
  const inputProps = { scenes };
  console.log(`Duree... ${totalResolvedFrames(scenes)} frames`);

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
