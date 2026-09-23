import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { fileSha256 } from './media-normalize.ts';

const LOCK_VERSION = 1;

const creditSchema = z.strictObject({ name: z.string().min(1), url: z.url() });

const sharedFields = {
  provider: z.literal('pexels'),
  query: z.string().min(1).max(80),
  providerAssetId: z.string().min(1).max(40),
  sourcePage: z.url(),
  credit: creditSchema,
  src: z.string().min(1).max(200),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
};

const imageEntrySchema = z.strictObject({
  ...sharedFields,
  kind: z.literal('image'),
  format: z.enum(['jpeg', 'png', 'webp']),
});

const videoEntrySchema = z.strictObject({
  ...sharedFields,
  kind: z.literal('video'),
  providerVariantId: z.string().min(1).max(40),
  durationInSeconds: z.number().positive(),
});

const entrySchema = z.discriminatedUnion('kind', [imageEntrySchema, videoEntrySchema]);

export const mediaLockSchema = z.strictObject({
  version: z.literal(LOCK_VERSION),
  entries: z.record(z.string().min(1), entrySchema),
});

export type MediaLockEntry = z.infer<typeof entrySchema>;
export type MediaLock = z.infer<typeof mediaLockSchema>;

export const emptyLock = (): MediaLock => ({ version: LOCK_VERSION, entries: {} });

export const mediaLockKey = (intent: { kind: 'image' | 'video'; query: string }): string =>
  `${intent.kind}:${intent.query.trim().toLowerCase()}`;

export const parseMediaLock = (raw: string): MediaLock => {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error('media-lock : JSON illisible', { cause: error });
  }

  const parsed = mediaLockSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue === undefined ? 'cause inconnue' : issue.path.join('.');
    throw new Error(`media-lock : contenu invalide (${where})`);
  }

  return parsed.data;
};

export const serializeMediaLock = (lock: MediaLock): string => {
  // Le passage par le schema fixe l ordre des champs : la definition Zod fait foi.
  const valide = mediaLockSchema.parse(lock);
  const entries: Record<string, MediaLockEntry> = {};
  for (const key of Object.keys(valide.entries).sort()) {
    const entry = valide.entries[key];
    if (entry !== undefined) entries[key] = entry;
  }
  return `${JSON.stringify({ version: valide.version, entries }, null, 2)}\n`;
};

export const readMediaLock = async (file: string): Promise<MediaLock> => {
  const raw = await readFile(file, 'utf8').catch(() => null);
  return raw === null ? emptyLock() : parseMediaLock(raw);
};

export const writeMediaLock = async (file: string, lock: MediaLock): Promise<void> => {
  const temporary = path.join(path.dirname(file), `${path.basename(file)}.part`);
  await writeFile(temporary, serializeMediaLock(lock), 'utf8');
  await rename(temporary, file);
};

export type EntryState = 'ok' | 'absent' | 'altere';

export const checkEntryFile = async (
  entry: MediaLockEntry,
  assetsDir: string,
): Promise<EntryState> => {
  const file = path.join(assetsDir, entry.src);
  const actual = await fileSha256(file).catch(() => null);
  if (actual === null) return 'absent';
  return actual === entry.sha256 ? 'ok' : 'altere';
};
