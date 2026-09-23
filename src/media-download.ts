import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { MAX_VARIANT_BYTES } from './media-selection.ts';

const ALLOWED_HOSTS = new Set(['images.pexels.com', 'videos.pexels.com']);
const MAX_IMAGE_BYTES = 25_000_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const ACCEPTED_VIDEO_CODEC = 'h264';

export type ImageFormat = 'jpeg' | 'png' | 'webp';

const IMAGE_FORMAT_BY_CODEC = new Map<string, ImageFormat>([
  ['mjpeg', 'jpeg'],
  ['png', 'png'],
  ['webp', 'webp'],
]);

const EXTENSION_BY_FORMAT: Record<ImageFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };

export type DownloadedImage = {
  kind: 'image';
  path: string;
  sha256: string;
  sizeInBytes: number;
  width: number;
  height: number;
  format: ImageFormat;
};

export type DownloadedVideo = {
  kind: 'video';
  path: string;
  sha256: string;
  sizeInBytes: number;
  width: number;
  height: number;
  durationInSeconds: number;
};

export type DownloadedAsset = DownloadedImage | DownloadedVideo;

export type DownloadRequest = {
  url: string;
  kind: 'image' | 'video';
  baseName: string;
  directory: string;
};

export const assertDownloadUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`URL de media illisible : ${JSON.stringify(raw)}`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`URL de media non HTTPS refusee : ${url.protocol}`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error(`URL de media avec identifiants refusee : ${url.hostname}`);
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Hote de media non autorise : ${url.hostname}`);
  }

  return url;
};

const maxBytesFor = (kind: 'image' | 'video'): number =>
  kind === 'image' ? MAX_IMAGE_BYTES : MAX_VARIANT_BYTES;

const streamToFile = async (
  url: URL,
  destination: string,
  maxBytes: number,
): Promise<{ sizeInBytes: number; sha256: string }> => {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Telechargement injoignable (${url.hostname}) : ${detail}`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`Telechargement HTTP ${response.status} sur ${url.hostname}`);
  }

  const announced = response.headers.get('content-length');
  if (announced !== null) {
    const size = Number(announced);
    if (!Number.isInteger(size) || size < 0) {
      throw new Error(`Content-Length invalide : ${JSON.stringify(announced)}`);
    }
    if (size > maxBytes) {
      throw new Error(`Content-Length ${size} depasse le plafond de ${maxBytes} octets`);
    }
  }

  const body = response.body;
  if (body === null) {
    throw new Error(`Reponse sans corps sur ${url.hostname}`);
  }

  const hash = createHash('sha256');
  const file = createWriteStream(destination);
  let received = 0;

  try {
    for await (const chunk of body) {
      received += chunk.byteLength;
      if (received > maxBytes) {
        throw new Error(`Flux depasse le plafond de ${maxBytes} octets`);
      }
      hash.update(chunk);
      if (!file.write(chunk)) await once(file, 'drain');
    }
  } finally {
    file.end();
    await once(file, 'close');
  }

  if (received === 0) {
    throw new Error(`Telechargement vide depuis ${url.hostname}`);
  }

  return { sizeInBytes: received, sha256: hash.digest('hex') };
};

const probeStreamSchema = z.object({
  codec_type: z.string(),
  codec_name: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

const probeSchema = z.object({
  streams: z.array(probeStreamSchema).min(1),
  format: z.object({ format_name: z.string(), duration: z.string().optional() }),
});

export type Probe = z.infer<typeof probeSchema>;

export const parseProbe = (stdout: string): Probe => {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error('ffprobe : sortie JSON illisible', { cause: error });
  }

  const parsed = probeSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue === undefined ? 'cause inconnue' : issue.path.join('.');
    throw new Error(`ffprobe : sortie hors contrat (${where})`);
  }

  return parsed.data;
};

export const probeFile = async (file: string): Promise<Probe> => {
  const args = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file];

  const { code, stdout, stderr } = await new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn('ffprobe', args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString('utf8');
    });
    child.on('error', (error: Error) => {
      reject(new Error(`ffprobe introuvable ou non executable : ${error.message}`));
    });
    child.on('close', (status) => {
      resolve({ code: status, stdout: out, stderr: err });
    });
  });

  if (code !== 0) {
    throw new Error(`ffprobe a echoue (code ${code}) : ${stderr.trim()}`);
  }

  return parseProbe(stdout);
};

const visualStream = (probe: Probe) => probe.streams.find((s) => s.codec_type === 'video');

export const describeImage = (
  probe: Probe,
): { width: number; height: number; format: ImageFormat } => {
  const stream = visualStream(probe);
  if (stream === undefined) {
    throw new Error("Le fichier telecharge ne contient aucune image (aucun flux 'video')");
  }

  const format = IMAGE_FORMAT_BY_CODEC.get(stream.codec_name ?? '');
  if (format === undefined) {
    throw new Error(
      `Format d'image non supporte : ${stream.codec_name ?? 'inconnu'} ` +
        `(attendus : ${[...IMAGE_FORMAT_BY_CODEC.keys()].join(', ')})`,
    );
  }

  const { width, height } = stream;
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    throw new Error(`Dimensions d'image invalides : ${String(width)}x${String(height)}`);
  }

  return { width, height, format };
};

export const describeVideo = (
  probe: Probe,
): { width: number; height: number; durationInSeconds: number } => {
  const stream = visualStream(probe);
  if (stream === undefined) {
    throw new Error('Le fichier telecharge ne contient aucun flux video');
  }

  if (stream.codec_name !== ACCEPTED_VIDEO_CODEC) {
    throw new Error(
      `Codec video non supporte : ${stream.codec_name ?? 'inconnu'} ` +
        `(seul ${ACCEPTED_VIDEO_CODEC} est accepte)`,
    );
  }

  const { width, height } = stream;
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    throw new Error(`Dimensions video invalides : ${String(width)}x${String(height)}`);
  }

  const durationInSeconds = Number.parseFloat(probe.format.duration ?? '');
  if (!Number.isFinite(durationInSeconds) || durationInSeconds <= 0) {
    throw new Error(`Duree video invalide : ${JSON.stringify(probe.format.duration)}`);
  }

  return { width, height, durationInSeconds };
};

export const downloadAsset = async (request: DownloadRequest): Promise<DownloadedAsset> => {
  const url = assertDownloadUrl(request.url);
  await mkdir(request.directory, { recursive: true });

  const temporary = path.join(request.directory, `${request.baseName}.part`);

  try {
    const { sizeInBytes, sha256 } = await streamToFile(url, temporary, maxBytesFor(request.kind));
    const probe = await probeFile(temporary);

    if (request.kind === 'image') {
      const { width, height, format } = describeImage(probe);
      const final = path.join(
        request.directory,
        `${request.baseName}.${EXTENSION_BY_FORMAT[format]}`,
      );
      await rename(temporary, final);
      return { kind: 'image', path: final, sha256, sizeInBytes, width, height, format };
    }

    const { width, height, durationInSeconds } = describeVideo(probe);
    const final = path.join(request.directory, `${request.baseName}.mp4`);
    await rename(temporary, final);
    return { kind: 'video', path: final, sha256, sizeInBytes, width, height, durationInSeconds };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
};
