import { z } from 'zod';

const PHOTOS_ENDPOINT = 'https://api.pexels.com/v1/search';
const VIDEOS_ENDPOINT = 'https://api.pexels.com/v1/videos/search';

const ORIENTATION = 'portrait';
const DEFAULT_PER_PAGE = 10;
const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2_000_000;

const photoSchema = z.object({
  id: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.url(),
  photographer: z.string().min(1),
  photographer_url: z.url(),
  src: z.object({ original: z.url() }),
});

const videoFileSchema = z.object({
  id: z.number().int().positive(),
  file_type: z.string().min(1),
  size: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive().nullish(),
  link: z.url(),
});

const videoSchema = z.object({
  id: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration: z.number().int().positive(),
  url: z.url(),
  user: z.object({ name: z.string().min(1), url: z.url() }),
  video_files: z.array(videoFileSchema).min(1),
});

const photosResponseSchema = z.object({ photos: z.array(photoSchema) });
const videosResponseSchema = z.object({ videos: z.array(videoSchema) });

export type PexelsCredit = { name: string; url: string };

export type PexelsImageCandidate = {
  kind: 'image';
  id: number;
  width: number;
  height: number;
  sourceUrl: string;
  credit: PexelsCredit;
  downloadUrl: string;
};

export type PexelsVideoFile = {
  id: number;
  fileType: string;
  sizeInBytes: number;
  width: number;
  height: number;
  fps: number | null;
  link: string;
};

export type PexelsVideoCandidate = {
  kind: 'video';
  id: number;
  width: number;
  height: number;
  durationInSeconds: number;
  sourceUrl: string;
  credit: PexelsCredit;
  files: PexelsVideoFile[];
};

export type PexelsSearchOptions = { perPage?: number };

const quotaHint = (response: Response): string => {
  const remaining = response.headers.get('X-Ratelimit-Remaining');
  const reset = response.headers.get('X-Ratelimit-Reset');
  if (remaining === null && reset === null) return '';
  return ` (restant ${remaining ?? '?'}, reinitialisation ${reset ?? '?'})`;
};

const statusMessage = (response: Response, endpoint: string): string => {
  switch (response.status) {
    case 401:
      return `Pexels 401 sur ${endpoint} : PEXELS_API_KEY refusee`;
    case 403:
      return `Pexels 403 sur ${endpoint} : acces interdit`;
    case 429:
      return `Pexels 429 sur ${endpoint} : quota atteint${quotaHint(response)}`;
    default:
      return `Pexels ${response.status} sur ${endpoint}`;
  }
};

const request = async (endpoint: string, query: string, perPage: number): Promise<unknown> => {
  const key = process.env['PEXELS_API_KEY'];
  if (key === undefined || key.trim() === '') {
    throw new Error('PEXELS_API_KEY absente de l environnement');
  }

  const url = new URL(endpoint);
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', ORIENTATION);
  url.searchParams.set('per_page', String(perPage));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Pexels injoignable sur ${endpoint} : ${detail}`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(statusMessage(response, endpoint));
  }

  const body = await response.text();
  if (body.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Pexels : reponse trop volumineuse (${body.length} octets)`);
  }

  try {
    const parsed: unknown = JSON.parse(body);
    return parsed;
  } catch (error) {
    throw new Error(`Pexels : reponse JSON illisible sur ${endpoint}`, { cause: error });
  }
};

export const toImageCandidates = (payload: unknown): PexelsImageCandidate[] =>
  photosResponseSchema.parse(payload).photos.map((photo) => ({
    kind: 'image',
    id: photo.id,
    width: photo.width,
    height: photo.height,
    sourceUrl: photo.url,
    credit: { name: photo.photographer, url: photo.photographer_url },
    downloadUrl: photo.src.original,
  }));

export const toVideoCandidates = (payload: unknown): PexelsVideoCandidate[] =>
  videosResponseSchema.parse(payload).videos.map((video) => ({
    kind: 'video',
    id: video.id,
    width: video.width,
    height: video.height,
    durationInSeconds: video.duration,
    sourceUrl: video.url,
    credit: { name: video.user.name, url: video.user.url },
    files: video.video_files.map((file) => ({
      id: file.id,
      fileType: file.file_type,
      sizeInBytes: file.size,
      width: file.width,
      height: file.height,
      fps: file.fps ?? null,
      link: file.link,
    })),
  }));

export const searchPexelsImages = async (
  query: string,
  options: PexelsSearchOptions = {},
): Promise<PexelsImageCandidate[]> =>
  toImageCandidates(await request(PHOTOS_ENDPOINT, query, options.perPage ?? DEFAULT_PER_PAGE));

export const searchPexelsVideos = async (
  query: string,
  options: PexelsSearchOptions = {},
): Promise<PexelsVideoCandidate[]> =>
  toVideoCandidates(await request(VIDEOS_ENDPOINT, query, options.perPage ?? DEFAULT_PER_PAGE));
