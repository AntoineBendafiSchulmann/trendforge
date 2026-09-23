import { afterEach, describe, expect, it, vi } from 'vitest';
import imagesFixture from './fixtures/pexels-images.json' with { type: 'json' };
import videosFixture from './fixtures/pexels-videos.json' with { type: 'json' };
import {
  searchPexelsImages,
  searchPexelsVideos,
  toImageCandidates,
  toVideoCandidates,
} from '../src/pexels.ts';

const jsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), init);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('candidats image', () => {
  const candidats = toImageCandidates(imagesFixture);

  it('convertit chaque photo de la reponse', () => {
    expect(candidats).toHaveLength(3);
    expect(candidats.map((c) => c.id)).toEqual([1105189, 2029667, 3573351]);
  });

  it('conserve les dimensions telles que fournies', () => {
    expect(candidats[0]).toMatchObject({ kind: 'image', width: 2848, height: 4272 });
    expect(candidats[1]).toMatchObject({ width: 1080, height: 1620 });
  });

  it('conserve la provenance et l attribution', () => {
    expect(candidats[0]?.sourceUrl).toBe('https://www.pexels.com/photo/1105189/');
    expect(candidats[0]?.credit).toEqual({
      name: 'Alex Dupont',
      url: 'https://www.pexels.com/@alex-dupont',
    });
  });

  it('expose la variante originale comme source de telechargement', () => {
    expect(candidats[0]?.downloadUrl).toBe(
      'https://images.pexels.com/photos/1105189/pexels-photo-1105189.jpeg',
    );
  });

  it('ignore les champs Pexels que nous ne consommons pas', () => {
    expect(candidats[0]).not.toHaveProperty('avg_color');
    expect(candidats[0]).not.toHaveProperty('alt');
    expect(candidats[0]).not.toHaveProperty('liked');
  });

  it('rejette une photo sans champ requis', () => {
    expect(() => toImageCandidates({ photos: [{ id: 1, width: 10 }] })).toThrow();
  });

  it('rejette un type incorrect', () => {
    const photo = { ...imagesFixture.photos[0], width: '2848' };
    expect(() => toImageCandidates({ photos: [photo] })).toThrow();
  });

  it('rejette une URL qui n en est pas une', () => {
    const photo = { ...imagesFixture.photos[0], src: { original: 'pas-une-url' } };
    expect(() => toImageCandidates({ photos: [photo] })).toThrow();
  });

  it('rejette une enveloppe mal formee', () => {
    expect(() => toImageCandidates({})).toThrow();
    expect(() => toImageCandidates({ photos: {} })).toThrow();
    expect(() => toImageCandidates(null)).toThrow();
  });
});

describe('candidats video', () => {
  const candidats = toVideoCandidates(videosFixture);

  it('convertit chaque video de la reponse', () => {
    expect(candidats).toHaveLength(2);
    expect(candidats.map((c) => c.id)).toEqual([5152416, 8721904]);
  });

  it('expose la duree en secondes', () => {
    expect(candidats[0]?.durationInSeconds).toBe(12);
    expect(candidats[1]?.durationInSeconds).toBe(5);
  });

  it('conserve toutes les variantes telechargeables', () => {
    expect(candidats[0]?.files).toHaveLength(3);
    expect(candidats[1]?.files).toHaveLength(2);
  });

  it('conserve les dimensions, le type et la taille de chaque variante', () => {
    expect(candidats[0]?.files[1]).toEqual({
      id: 20399872,
      width: 1080,
      height: 1920,
      fileType: 'video/mp4',
      sizeInBytes: 32226638,
      fps: 30,
      link: 'https://videos.pexels.com/video-files/5152416/5152416-hd_1080_1920_30fps.mp4',
    });
  });

  it('accepte quality null et quality uhd cote provider', () => {
    const brutes = videosFixture.videos[0]?.video_files ?? [];
    expect(brutes.map((f) => f.quality)).toEqual(['uhd', null, null]);
    expect(candidats[0]?.files).toHaveLength(3);
  });

  it('n expose jamais quality dans le candidat interne', () => {
    for (const candidat of candidats) {
      for (const fichier of candidat.files) {
        expect(fichier).not.toHaveProperty('quality');
      }
    }
  });

  it('accepte un fps decimal', () => {
    expect(candidats[1]?.files[0]?.fps).toBe(29.97);
  });

  it('rejette une taille absente, nulle ou non entiere', () => {
    const variante = videosFixture.videos[0]?.video_files[0];
    for (const size of [null, 0, -1, 1.5, '32226638']) {
      const video = { ...videosFixture.videos[0], video_files: [{ ...variante, size }] };
      expect(() => toVideoCandidates({ videos: [video] })).toThrow();
    }
    const sansTaille: Record<string, unknown> = { ...variante };
    delete sansTaille['size'];
    expect(() =>
      toVideoCandidates({ videos: [{ ...videosFixture.videos[0], video_files: [sansTaille] }] }),
    ).toThrow();
  });

  it('normalise un fps absent en null', () => {
    const video = {
      ...videosFixture.videos[1],
      video_files: [{ ...videosFixture.videos[1]?.video_files[0], fps: null }],
    };
    expect(toVideoCandidates({ videos: [video] })[0]?.files[0]?.fps).toBeNull();
  });

  it('conserve la provenance et l attribution', () => {
    expect(candidats[0]?.sourceUrl).toBe('https://www.pexels.com/video/5152416/');
    expect(candidats[0]?.credit.name).toBe('Noor Lemaire');
  });

  it('ignore les champs Pexels que nous ne consommons pas', () => {
    expect(candidats[0]).not.toHaveProperty('image');
    expect(candidats[0]).not.toHaveProperty('video_pictures');
    expect(candidats[0]).not.toHaveProperty('tags');
  });

  it('rejette une video sans champ requis', () => {
    const video: Record<string, unknown> = { ...videosFixture.videos[0] };
    delete video['duration'];
    expect(() => toVideoCandidates({ videos: [video] })).toThrow();
  });

  it('rejette explicitement une video sans variante telechargeable', () => {
    const video = { ...videosFixture.videos[0], video_files: [] };
    expect(() => toVideoCandidates({ videos: [video] })).toThrow();
  });

  it('rejette une variante incomplete', () => {
    const video = { ...videosFixture.videos[0], video_files: [{ id: 1, width: 1080 }] };
    expect(() => toVideoCandidates({ videos: [video] })).toThrow();
  });
});

describe('appel HTTP', () => {
  it('echoue sans PEXELS_API_KEY', async () => {
    vi.stubEnv('PEXELS_API_KEY', '');
    await expect(searchPexelsImages('ville')).rejects.toThrow('PEXELS_API_KEY absente');
  });

  it('appelle le bon endpoint avec les bons parametres', async () => {
    vi.stubEnv('PEXELS_API_KEY', 'cle-de-test');
    const appels: { url: string; auth: string | undefined }[] = [];
    vi.stubGlobal('fetch', (input: URL, init: RequestInit) => {
      const headers = new Headers(init.headers);
      appels.push({ url: input.toString(), auth: headers.get('Authorization') ?? undefined });
      return Promise.resolve(jsonResponse(imagesFixture));
    });

    await searchPexelsImages('Paris aerial night');

    expect(appels[0]?.url).toBe(
      'https://api.pexels.com/v1/search?query=Paris+aerial+night&orientation=portrait&per_page=10',
    );
    expect(appels[0]?.auth).toBe('cle-de-test');
  });

  it('utilise l endpoint video officiel v1', async () => {
    vi.stubEnv('PEXELS_API_KEY', 'cle-de-test');
    const vues: string[] = [];
    vi.stubGlobal('fetch', (input: URL) => {
      vues.push(input.toString());
      return Promise.resolve(jsonResponse(videosFixture));
    });

    await searchPexelsVideos('ville', { perPage: 3 });

    expect(vues[0]).toBe(
      'https://api.pexels.com/v1/videos/search?query=ville&orientation=portrait&per_page=3',
    );
  });

  it.each([
    [401, 'PEXELS_API_KEY refusee'],
    [403, 'acces interdit'],
    [500, 'Pexels 500'],
  ])('signale explicitement un %i', async (status, attendu) => {
    vi.stubEnv('PEXELS_API_KEY', 'cle-de-test');
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status })));
    await expect(searchPexelsImages('ville')).rejects.toThrow(attendu);
  });

  it('inclut le quota restant sur un 429', async () => {
    vi.stubEnv('PEXELS_API_KEY', 'cle-de-test');
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('', {
          status: 429,
          headers: { 'X-Ratelimit-Remaining': '0', 'X-Ratelimit-Reset': '1790000000' },
        }),
      ),
    );
    await expect(searchPexelsImages('ville')).rejects.toThrow('quota atteint (restant 0');
  });

  it('signale une erreur reseau', async () => {
    vi.stubEnv('PEXELS_API_KEY', 'cle-de-test');
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNRESET')));
    await expect(searchPexelsImages('ville')).rejects.toThrow('Pexels injoignable');
  });

  it('signale un JSON illisible', async () => {
    vi.stubEnv('PEXELS_API_KEY', 'cle-de-test');
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{ pas du json')));
    await expect(searchPexelsImages('ville')).rejects.toThrow('JSON illisible');
  });

  it('signale un JSON valide mais hors contrat', async () => {
    vi.stubEnv('PEXELS_API_KEY', 'cle-de-test');
    vi.stubGlobal('fetch', () => Promise.resolve(jsonResponse({ resultats: [] })));
    await expect(searchPexelsImages('ville')).rejects.toThrow();
  });

  it('ne divulgue jamais la cle dans une erreur', async () => {
    vi.stubEnv('PEXELS_API_KEY', 'cle-tres-secrete');
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 401 })));
    const erreur = await searchPexelsImages('ville').catch((cause: unknown) => cause);
    expect(String(erreur)).toContain('401');
    expect(String(erreur)).not.toContain('cle-tres-secrete');
  });
});
