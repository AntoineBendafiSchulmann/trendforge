import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { runProcess } from './process.ts';
import {
  describeImage,
  describeVideo,
  probeFile,
  type DownloadedAsset,
  type DownloadedImage,
  type DownloadedVideo,
  type ImageFormat,
} from './media-download.ts';

export type CanonicalImage = {
  kind: 'image';
  src: string;
  sha256: string;
  width: number;
  height: number;
  format: ImageFormat;
};

export type CanonicalVideo = {
  kind: 'video';
  src: string;
  sha256: string;
  width: number;
  height: number;
  durationInSeconds: number;
};

export type CanonicalAsset = CanonicalImage | CanonicalVideo;

export type NormalizeRequest = {
  asset: DownloadedAsset;
  baseName: string;
  assetsDir: string;
};

export const fileSha256 = (file: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk: string | Buffer) => {
      hash.update(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
  });

export const canonicalSrc = (absolute: string, assetsDir: string): string => {
  const relative = path.relative(assetsDir, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Asset canonique hors de assets/ : ${absolute}`);
  }
  return relative.split(path.sep).join('/');
};

const normalizeImage = async (
  asset: DownloadedImage,
  baseName: string,
  assetsDir: string,
): Promise<CanonicalImage> => {
  const directory = path.dirname(asset.path);
  const canonical = path.join(directory, `${baseName}${path.extname(asset.path)}`);

  if (path.resolve(canonical) !== path.resolve(asset.path)) {
    await rename(asset.path, canonical);
  }

  const { width, height, format } = describeImage(await probeFile(canonical));

  return {
    kind: 'image',
    src: canonicalSrc(canonical, assetsDir),
    sha256: await fileSha256(canonical),
    width,
    height,
    format,
  };
};

const normalizeVideo = async (
  asset: DownloadedVideo,
  baseName: string,
  assetsDir: string,
): Promise<CanonicalVideo> => {
  const directory = path.dirname(asset.path);
  const temporary = path.join(directory, `${baseName}.part`);
  const canonical = path.join(directory, `${baseName}.mp4`);

  try {
    const { code, stderr } = await runProcess('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      asset.path,
      '-map',
      '0:v:0',
      '-c:v',
      'copy',
      '-an',
      '-f',
      'mp4',
      temporary,
    ]);
    if (code !== 0) {
      throw new Error(`ffmpeg a echoue (code ${code}) : ${stderr.trim()}`);
    }

    const probe = await probeFile(temporary);
    const { width, height, durationInSeconds } = describeVideo(probe);
    if (probe.streams.some((stream) => stream.codec_type === 'audio')) {
      throw new Error('Une piste audio subsiste apres normalisation');
    }

    await rename(temporary, canonical);
    await rm(asset.path, { force: true });

    return {
      kind: 'video',
      src: canonicalSrc(canonical, assetsDir),
      sha256: await fileSha256(canonical),
      width,
      height,
      durationInSeconds,
    };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
};

export const normalizeAsset = async (request: NormalizeRequest): Promise<CanonicalAsset> => {
  if ((await stat(request.asset.path).catch(() => null)) === null) {
    throw new Error(`Asset telecharge introuvable : ${request.asset.path}`);
  }

  return request.asset.kind === 'image'
    ? normalizeImage(request.asset, request.baseName, request.assetsDir)
    : normalizeVideo(request.asset, request.baseName, request.assetsDir);
};
