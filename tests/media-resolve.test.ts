import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  images: vi.fn(),
  videos: vi.fn(),
  download: vi.fn(),
  normalize: vi.fn(),
}));

vi.mock('../src/pexels.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/pexels.ts')>()),
  searchPexelsImages: fake.images,
  searchPexelsVideos: fake.videos,
}));

vi.mock('../src/media-download.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/media-download.ts')>()),
  downloadAsset: fake.download,
}));

vi.mock('../src/media-normalize.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/media-normalize.ts')>()),
  normalizeAsset: fake.normalize,
}));

const { parseMediaLock, serializeMediaLock } = await import('../src/media-lock.ts');
const { fileSha256 } = await import('../src/media-normalize.ts');
const { localFromEntry, resolveSceneMedia } = await import('../src/media-resolve.ts');

type MediaLockEntry = import('../src/media-lock.ts').MediaLockEntry;
type ResolveContext = import('../src/media-resolve.ts').ResolveContext;
type NormalizeRequest = import('../src/media-normalize.ts').NormalizeRequest;

const IMAGE_QUERY = 'modern tower architecture';
const VIDEO_QUERY = 'city skyline night';

const imageIntent = { mode: 'search', kind: 'image', query: IMAGE_QUERY } as const;
const videoIntent = { mode: 'search', kind: 'video', query: VIDEO_QUERY } as const;

let root: string;
let context: ResolveContext;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'trendforge-resolve-'));
  context = {
    assetsDir: path.join(root, 'assets'),
    mediaDir: path.join(root, 'assets', 'generated', 'media'),
    lockFile: path.join(root, 'content', 'media-lock.json'),
  };
  await mkdir(context.mediaDir, { recursive: true });
  await mkdir(path.dirname(context.lockFile), { recursive: true });
  vi.resetAllMocks();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const writeAsset = async (relative: string, content: string): Promise<string> => {
  const file = path.join(context.assetsDir, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
  return fileSha256(file);
};

const imageEntry = (src: string, sha256: string): MediaLockEntry => ({
  provider: 'pexels',
  kind: 'image',
  query: IMAGE_QUERY,
  providerAssetId: '4242',
  sourcePage: 'https://www.pexels.com/photo/4242/',
  credit: { name: 'Photographe', url: 'https://www.pexels.com/@photographe' },
  src,
  sha256,
  width: 1440,
  height: 2560,
  format: 'jpeg',
});

const videoEntry = (src: string, sha256: string): MediaLockEntry => ({
  provider: 'pexels',
  kind: 'video',
  query: VIDEO_QUERY,
  providerAssetId: '777',
  providerVariantId: '888',
  sourcePage: 'https://www.pexels.com/video/777/',
  credit: { name: 'Videaste', url: 'https://www.pexels.com/@videaste' },
  src,
  sha256,
  width: 1080,
  height: 1920,
  durationInSeconds: 10.56,
});

const seedLock = async (key: string, entry: MediaLockEntry): Promise<void> => {
  await writeFile(
    context.lockFile,
    serializeMediaLock({ version: 1, entries: { [key]: entry } }),
    'utf8',
  );
};

const noProviderCall = (): void => {
  expect(fake.images).not.toHaveBeenCalled();
  expect(fake.videos).not.toHaveBeenCalled();
};

describe('localFromEntry', () => {
  it('traduit une entree image en media local image', () => {
    expect(localFromEntry(imageEntry('generated/media/a.jpg', 'a'.repeat(64)))).toEqual({
      mode: 'local',
      type: 'image',
      src: 'generated/media/a.jpg',
    });
  });

  it('traduit une entree video en media local video', () => {
    expect(localFromEntry(videoEntry('generated/media/a.mp4', 'b'.repeat(64)))).toEqual({
      mode: 'local',
      type: 'video',
      src: 'generated/media/a.mp4',
    });
  });
});

describe('resolveSceneMedia sans recherche', () => {
  it('laisse passer les medias locaux et les scenes sans media', async () => {
    const local = { mode: 'local', type: 'image', src: 'demo/a.jpg' } as const;
    const { resolved, report } = await resolveSceneMedia([local, undefined], context);

    expect(resolved).toEqual([local, undefined]);
    expect(report).toEqual({ local: 1, reused: 0, fetched: 0 });
    noProviderCall();
  });

  it('ne cree aucun lock quand aucune recherche n est necessaire', async () => {
    await resolveSceneMedia([undefined], context);
    await expect(readFile(context.lockFile, 'utf8')).rejects.toThrow();
  });
});

describe('resolveSceneMedia avec lock', () => {
  it('reutilise une entree image sans appeler Pexels', async () => {
    const sha = await writeAsset('generated/media/tower.jpg', 'contenu-image');
    await seedLock(`image:${IMAGE_QUERY}`, imageEntry('generated/media/tower.jpg', sha));

    const { resolved, report } = await resolveSceneMedia([imageIntent], context);

    expect(resolved).toEqual([{ mode: 'local', type: 'image', src: 'generated/media/tower.jpg' }]);
    expect(report).toEqual({ local: 0, reused: 1, fetched: 0 });
    noProviderCall();
  });

  it('reutilise une entree video et produit un media de type video', async () => {
    const sha = await writeAsset('generated/media/skyline.mp4', 'contenu-video');
    await seedLock(`video:${VIDEO_QUERY}`, videoEntry('generated/media/skyline.mp4', sha));

    const { resolved, report } = await resolveSceneMedia([videoIntent], context);

    expect(resolved).toEqual([
      { mode: 'local', type: 'video', src: 'generated/media/skyline.mp4' },
    ]);
    expect(report).toEqual({ local: 0, reused: 1, fetched: 0 });
    noProviderCall();
  });

  it('retrouve l entree malgre la casse et les espaces de la query', async () => {
    const sha = await writeAsset('generated/media/tower.jpg', 'contenu-image');
    await seedLock(`image:${IMAGE_QUERY}`, imageEntry('generated/media/tower.jpg', sha));

    const { report } = await resolveSceneMedia(
      [{ mode: 'search', kind: 'image', query: '  Modern Tower ARCHITECTURE ' }],
      context,
    );

    expect(report.reused).toBe(1);
    noProviderCall();
  });

  it('ne reecrit pas le lock lors d une reutilisation', async () => {
    const sha = await writeAsset('generated/media/tower.jpg', 'contenu-image');
    await seedLock(`image:${IMAGE_QUERY}`, imageEntry('generated/media/tower.jpg', sha));
    const avant = await readFile(context.lockFile, 'utf8');

    await resolveSceneMedia([imageIntent], context);

    expect(await readFile(context.lockFile, 'utf8')).toBe(avant);
  });

  it('echoue si le fichier verrouille est absent', async () => {
    await seedLock(
      `image:${IMAGE_QUERY}`,
      imageEntry('generated/media/absent.jpg', 'c'.repeat(64)),
    );

    await expect(resolveSceneMedia([imageIntent], context)).rejects.toThrow('fichier absent');
    noProviderCall();
  });

  it('echoue si l empreinte du fichier verrouille differe', async () => {
    await writeAsset('generated/media/tower.jpg', 'contenu-altere');
    await seedLock(`image:${IMAGE_QUERY}`, imageEntry('generated/media/tower.jpg', 'd'.repeat(64)));

    await expect(resolveSceneMedia([imageIntent], context)).rejects.toThrow('empreinte differente');
    noProviderCall();
  });

  it('contextualise l erreur avec le numero de scene', async () => {
    await seedLock(
      `image:${IMAGE_QUERY}`,
      imageEntry('generated/media/absent.jpg', 'e'.repeat(64)),
    );

    await expect(resolveSceneMedia([undefined, undefined, imageIntent], context)).rejects.toThrow(
      'Scene 3 : media-lock',
    );
  });

  it('ne confond pas une entree image et une entree video de meme query', async () => {
    const sha = await writeAsset('generated/media/tower.jpg', 'contenu-image');
    await seedLock(`image:${VIDEO_QUERY}`, imageEntry('generated/media/tower.jpg', sha));
    fake.videos.mockResolvedValue([]);

    await expect(resolveSceneMedia([videoIntent], context)).rejects.toThrow();
    expect(fake.videos).toHaveBeenCalledTimes(1);
  });
});

describe('resolveSceneMedia avec telechargement', () => {
  const candidate = {
    kind: 'image',
    id: 4242,
    width: 1440,
    height: 2560,
    sourceUrl: 'https://www.pexels.com/photo/4242/',
    credit: { name: 'Photographe', url: 'https://www.pexels.com/@photographe' },
    downloadUrl: 'https://images.pexels.com/photos/4242/tower.jpg',
  };

  beforeEach(() => {
    fake.images.mockResolvedValue([candidate]);
    fake.download.mockResolvedValue({
      kind: 'image',
      path: path.join(context.mediaDir, 'pexels-image-4242.source.jpg'),
      sha256: 'f'.repeat(64),
      sizeInBytes: 1024,
      width: 1440,
      height: 2560,
      format: 'jpeg',
    });
    fake.normalize.mockImplementation(async (request: NormalizeRequest) => {
      const src = `generated/media/${request.baseName}.jpg`;
      const file = path.join(request.assetsDir, src);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, 'image-canonique', 'utf8');
      return {
        kind: 'image',
        src,
        sha256: await fileSha256(file),
        width: 1440,
        height: 2560,
        format: 'jpeg',
      };
    });
  });

  it('telecharge, normalise et ecrit une entree de lock complete', async () => {
    const { resolved, report } = await resolveSceneMedia([imageIntent], context);

    expect(resolved).toEqual([
      { mode: 'local', type: 'image', src: 'generated/media/pexels-image-4242.jpg' },
    ]);
    expect(report).toEqual({ local: 0, reused: 0, fetched: 1 });

    const lock = parseMediaLock(await readFile(context.lockFile, 'utf8'));
    expect(lock.entries[`image:${IMAGE_QUERY}`]).toMatchObject({
      provider: 'pexels',
      kind: 'image',
      query: IMAGE_QUERY,
      providerAssetId: '4242',
      sourcePage: candidate.sourceUrl,
      credit: candidate.credit,
      src: 'generated/media/pexels-image-4242.jpg',
      width: 1440,
      height: 2560,
      format: 'jpeg',
    });
  });

  it('telecharge depuis l URL du candidat retenu', async () => {
    await resolveSceneMedia([imageIntent], context);

    expect(fake.download).toHaveBeenCalledWith({
      url: candidate.downloadUrl,
      kind: 'image',
      baseName: 'pexels-image-4242.source',
      directory: context.mediaDir,
    });
  });

  it('reutilise le lock au second passage sans rappeler Pexels', async () => {
    await resolveSceneMedia([imageIntent], context);
    fake.images.mockClear();
    fake.download.mockClear();

    const { report } = await resolveSceneMedia([imageIntent], context);

    expect(report).toEqual({ local: 0, reused: 1, fetched: 0 });
    expect(fake.images).not.toHaveBeenCalled();
    expect(fake.download).not.toHaveBeenCalled();
  });

  it('ne recherche qu une fois deux scenes partageant la meme query', async () => {
    const { report } = await resolveSceneMedia([imageIntent, imageIntent], context);

    expect(report).toEqual({ local: 0, reused: 1, fetched: 1 });
    expect(fake.images).toHaveBeenCalledTimes(1);
  });
});
