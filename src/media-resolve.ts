import { VERTICAL_9_16 } from './config.ts';
import type { LocalMedia, Media, SearchMedia } from './content.ts';
import { downloadAsset } from './media-download.ts';
import {
  checkEntryFile,
  mediaLockKey,
  readMediaLock,
  writeMediaLock,
  type MediaLockEntry,
} from './media-lock.ts';
import { normalizeAsset } from './media-normalize.ts';
import { selectPexelsImage, selectPexelsVideo } from './media-selection.ts';
import { searchPexelsImages, searchPexelsVideos } from './pexels.ts';

export type ResolveContext = { assetsDir: string; mediaDir: string; lockFile: string };

export type ResolveReport = { local: number; reused: number; fetched: number };

export type ResolveResult = { resolved: (LocalMedia | undefined)[]; report: ResolveReport };

export const localFromEntry = (entry: MediaLockEntry): LocalMedia =>
  entry.kind === 'image'
    ? { mode: 'local', type: 'image', src: entry.src }
    : { mode: 'local', type: 'video', src: entry.src };

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const assertEntryUsable = async (
  key: string,
  entry: MediaLockEntry,
  assetsDir: string,
): Promise<void> => {
  const state = await checkEntryFile(entry, assetsDir);
  if (state === 'ok') return;
  const cause = state === 'absent' ? 'fichier absent' : 'empreinte differente';
  throw new Error(
    `media-lock : ${cause} pour "${key}" (${entry.src}). Restaure le fichier ou retire cette entree du lock pour relancer une recherche.`,
  );
};

const fetchImage = async (query: string, context: ResolveContext): Promise<MediaLockEntry> => {
  const candidate = selectPexelsImage(await searchPexelsImages(query), VERTICAL_9_16);
  const baseName = `pexels-image-${candidate.id}`;
  const asset = await downloadAsset({
    url: candidate.downloadUrl,
    kind: 'image',
    baseName: `${baseName}.source`,
    directory: context.mediaDir,
  });
  const canonical = await normalizeAsset({ asset, baseName, assetsDir: context.assetsDir });
  if (canonical.kind !== 'image') throw new Error('Normalisation image incoherente');

  return {
    provider: 'pexels',
    kind: 'image',
    query,
    providerAssetId: String(candidate.id),
    sourcePage: candidate.sourceUrl,
    credit: candidate.credit,
    src: canonical.src,
    sha256: canonical.sha256,
    width: canonical.width,
    height: canonical.height,
    format: canonical.format,
  };
};

const fetchVideo = async (query: string, context: ResolveContext): Promise<MediaLockEntry> => {
  const selected = selectPexelsVideo(await searchPexelsVideos(query), VERTICAL_9_16);
  const baseName = `pexels-video-${selected.candidate.id}-${selected.file.id}`;
  const asset = await downloadAsset({
    url: selected.file.link,
    kind: 'video',
    baseName: `${baseName}.source`,
    directory: context.mediaDir,
  });
  const canonical = await normalizeAsset({ asset, baseName, assetsDir: context.assetsDir });
  if (canonical.kind !== 'video') throw new Error('Normalisation video incoherente');

  return {
    provider: 'pexels',
    kind: 'video',
    query,
    providerAssetId: String(selected.candidate.id),
    providerVariantId: String(selected.file.id),
    sourcePage: selected.candidate.sourceUrl,
    credit: selected.candidate.credit,
    src: canonical.src,
    sha256: canonical.sha256,
    width: canonical.width,
    height: canonical.height,
    durationInSeconds: canonical.durationInSeconds,
  };
};

const fetchEntry = (intent: SearchMedia, context: ResolveContext): Promise<MediaLockEntry> =>
  intent.kind === 'image' ? fetchImage(intent.query, context) : fetchVideo(intent.query, context);

export const resolveSceneMedia = async (
  medias: readonly (Media | undefined)[],
  context: ResolveContext,
): Promise<ResolveResult> => {
  const lock = await readMediaLock(context.lockFile);
  const resolved: (LocalMedia | undefined)[] = [];
  const report: ResolveReport = { local: 0, reused: 0, fetched: 0 };
  let dirty = false;

  for (const [index, media] of medias.entries()) {
    try {
      if (media === undefined) {
        resolved.push(undefined);
        continue;
      }

      if (media.mode === 'local') {
        resolved.push(media);
        report.local += 1;
        continue;
      }

      const key = mediaLockKey(media);
      const known = lock.entries[key];

      if (known !== undefined) {
        await assertEntryUsable(key, known, context.assetsDir);
        resolved.push(localFromEntry(known));
        report.reused += 1;
        continue;
      }

      const entry = await fetchEntry(media, context);
      lock.entries[key] = entry;
      dirty = true;
      resolved.push(localFromEntry(entry));
      report.fetched += 1;
    } catch (error) {
      throw new Error(`Scene ${index + 1} : ${reason(error)}`, { cause: error });
    }
  }

  if (dirty) await writeMediaLock(context.lockFile, lock);
  return { resolved, report };
};
