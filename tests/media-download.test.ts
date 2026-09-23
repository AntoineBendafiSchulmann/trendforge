import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertDownloadUrl,
  describeImage,
  describeVideo,
  downloadAsset,
  parseProbe,
} from '../src/media-download.ts';

const IMAGE_URL = 'https://images.pexels.com/photos/1105189/pexels-photo-1105189.jpeg';
const VIDEO_URL = 'https://videos.pexels.com/video-files/5152416/5152416-hd_1080_1920_30fps.mp4';

const octets = (n: number, valeur = 65) => new Uint8Array(n).fill(valeur);

const fluxDe = (morceaux: readonly Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controleur) {
      for (const m of morceaux) controleur.enqueue(m);
      controleur.close();
    },
  });

const reponse = (corps: BodyInit | null, init?: ResponseInit) => new Response(corps, init);

const dossierTemporaire = async () => mkdtemp(path.join(tmpdir(), 'tf-dl-'));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validation d URL', () => {
  it('accepte les hotes Pexels en HTTPS', () => {
    expect(assertDownloadUrl(IMAGE_URL).hostname).toBe('images.pexels.com');
    expect(assertDownloadUrl(VIDEO_URL).hostname).toBe('videos.pexels.com');
  });

  it('refuse un protocole non HTTPS', () => {
    expect(() => assertDownloadUrl('http://images.pexels.com/a.jpg')).toThrow('non HTTPS');
    expect(() => assertDownloadUrl('file:///etc/passwd')).toThrow('non HTTPS');
    expect(() => assertDownloadUrl('data:image/png;base64,AAAA')).toThrow('non HTTPS');
  });

  it('refuse un hote non autorise', () => {
    expect(() => assertDownloadUrl('https://evil.example.com/a.jpg')).toThrow('Hote de media');
    expect(() => assertDownloadUrl('https://localhost/a.jpg')).toThrow('Hote de media');
    expect(() => assertDownloadUrl('https://127.0.0.1/a.jpg')).toThrow('Hote de media');
    expect(() => assertDownloadUrl('https://192.168.1.10/a.jpg')).toThrow('Hote de media');
    expect(() => assertDownloadUrl('https://images.pexels.com.evil.net/a.jpg')).toThrow(
      'Hote de media',
    );
  });

  it('refuse des identifiants dans l URL', () => {
    expect(() => assertDownloadUrl('https://user:pass@images.pexels.com/a.jpg')).toThrow(
      'identifiants',
    );
  });

  it('refuse une URL illisible', () => {
    expect(() => assertDownloadUrl('pas une url')).toThrow('illisible');
  });
});

describe('lecture de la sortie ffprobe', () => {
  const IMAGE_JSON = JSON.stringify({
    streams: [{ codec_type: 'video', codec_name: 'mjpeg', width: 1600, height: 900 }],
    format: { format_name: 'image2', duration: '0.040000' },
  });

  it('accepte une sortie image valide', () => {
    expect(parseProbe(IMAGE_JSON).streams[0]?.codec_name).toBe('mjpeg');
  });

  it('refuse un JSON illisible', () => {
    expect(() => parseProbe('{ pas du json')).toThrow('JSON illisible');
  });

  it('refuse un JSON hors contrat', () => {
    expect(() => parseProbe(JSON.stringify({ streams: [] }))).toThrow('hors contrat');
    expect(() => parseProbe(JSON.stringify({ format: {} }))).toThrow('hors contrat');
  });
});

describe('description d une image', () => {
  const sonde = (stream: Record<string, unknown>) =>
    parseProbe(JSON.stringify({ streams: [stream], format: { format_name: 'image2' } }));

  it.each([
    ['mjpeg', 'jpeg'],
    ['png', 'png'],
    ['webp', 'webp'],
  ])('reconnait le codec %s comme %s', (codec, format) => {
    const decrit = describeImage(
      sonde({ codec_type: 'video', codec_name: codec, width: 10, height: 20 }),
    );
    expect(decrit).toEqual({ width: 10, height: 20, format });
  });

  it('refuse un format d image non supporte', () => {
    expect(() =>
      describeImage(sonde({ codec_type: 'video', codec_name: 'gif', width: 10, height: 20 })),
    ).toThrow("Format d'image non supporte");
  });

  it('refuse un fichier sans flux visuel', () => {
    expect(() => describeImage(sonde({ codec_type: 'audio', codec_name: 'aac' }))).toThrow(
      'aucune image',
    );
  });

  it('refuse des dimensions invalides', () => {
    expect(() =>
      describeImage(sonde({ codec_type: 'video', codec_name: 'png', width: 0, height: 20 })),
    ).toThrow('Dimensions');
    expect(() => describeImage(sonde({ codec_type: 'video', codec_name: 'png' }))).toThrow(
      'Dimensions',
    );
  });
});

describe('description d une video', () => {
  const sonde = (streams: Record<string, unknown>[], duration?: string) =>
    parseProbe(JSON.stringify({ streams, format: { format_name: 'mov,mp4', duration } }));

  const H264 = { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920 };

  it('accepte une video H.264 valide', () => {
    expect(describeVideo(sonde([H264], '12.5'))).toEqual({
      width: 1080,
      height: 1920,
      durationInSeconds: 12.5,
    });
  });

  it('accepte une video accompagnee d une piste audio', () => {
    const avecAudio = sonde([H264, { codec_type: 'audio', codec_name: 'aac' }], '5.0');
    expect(describeVideo(avecAudio).durationInSeconds).toBe(5);
  });

  it.each(['hevc', 'av1', 'vp9', 'mpeg4'])('refuse le codec %s', (codec) => {
    expect(() => describeVideo(sonde([{ ...H264, codec_name: codec }], '5.0'))).toThrow(
      'Codec video non supporte',
    );
  });

  it('refuse un fichier sans flux video', () => {
    expect(() => describeVideo(sonde([{ codec_type: 'audio', codec_name: 'aac' }], '5.0'))).toThrow(
      'aucun flux video',
    );
  });

  it('refuse des dimensions invalides', () => {
    expect(() => describeVideo(sonde([{ ...H264, width: 0 }], '5.0'))).toThrow('Dimensions');
  });

  it.each([undefined, '', 'N/A', '0', '-3'])('refuse la duree %s', (duration) => {
    expect(() => describeVideo(sonde([H264], duration))).toThrow('Duree video invalide');
  });
});

describe('telechargement : refus avant tout octet', () => {
  it('refuse une URL hors allowlist sans appeler fetch', async () => {
    const appels: string[] = [];
    vi.stubGlobal('fetch', (u: URL) => {
      appels.push(u.toString());
      return Promise.resolve(reponse(octets(10)));
    });
    const directory = await dossierTemporaire();
    try {
      await expect(
        downloadAsset({
          url: 'https://evil.example.com/a.jpg',
          kind: 'image',
          baseName: 'a',
          directory,
        }),
      ).rejects.toThrow('Hote de media');
      expect(appels).toHaveLength(0);
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('telechargement : bornes et nettoyage', () => {
  const tenter = async (
    fetchFactice: () => Promise<Response>,
    kind: 'image' | 'video' = 'image',
  ) => {
    vi.stubGlobal('fetch', fetchFactice);
    const directory = await dossierTemporaire();
    try {
      const erreur = await downloadAsset({
        url: IMAGE_URL,
        kind,
        baseName: 'asset',
        directory,
      }).catch((cause: unknown) => cause);
      return { erreur: String(erreur), restes: await readdir(directory), directory };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };

  it('refuse un Content-Length superieur au plafond', async () => {
    const { erreur, restes } = await tenter(() =>
      Promise.resolve(reponse(octets(10), { headers: { 'content-length': String(25_000_001) } })),
    );
    expect(erreur).toContain('Content-Length 25000001 depasse le plafond');
    expect(restes).toEqual([]);
  });

  it('refuse un Content-Length invalide', async () => {
    const { erreur } = await tenter(() =>
      Promise.resolve(reponse(octets(10), { headers: { 'content-length': 'beaucoup' } })),
    );
    expect(erreur).toContain('Content-Length invalide');
  });

  it('arrete le flux qui depasse le plafond sans Content-Length', async () => {
    const gros = Array.from({ length: 30 }, () => octets(1_000_000));
    const { erreur, restes } = await tenter(() => Promise.resolve(reponse(fluxDe(gros))));
    expect(erreur).toContain('Flux depasse le plafond de 25000000 octets');
    expect(restes).toEqual([]);
  });

  it('refuse un telechargement vide', async () => {
    const { erreur, restes } = await tenter(() => Promise.resolve(reponse(fluxDe([]))));
    expect(erreur).toContain('Telechargement vide');
    expect(restes).toEqual([]);
  });

  it('signale un statut HTTP non 2xx', async () => {
    const { erreur, restes } = await tenter(() => Promise.resolve(reponse(null, { status: 404 })));
    expect(erreur).toContain('Telechargement HTTP 404');
    expect(restes).toEqual([]);
  });

  it('signale une erreur reseau', async () => {
    const { erreur, restes } = await tenter(() => Promise.reject(new Error('ECONNRESET')));
    expect(erreur).toContain('Telechargement injoignable');
    expect(restes).toEqual([]);
  });

  it('ne laisse jamais de fichier final ni de .part apres un echec', async () => {
    const { restes } = await tenter(() => Promise.resolve(reponse(fluxDe([]))));
    expect(restes.filter((n) => n.endsWith('.part'))).toEqual([]);
    expect(restes).toEqual([]);
  });

  it('applique le plafond video de 100 Mo aux videos', async () => {
    const { erreur } = await tenter(
      () =>
        Promise.resolve(
          reponse(octets(10), { headers: { 'content-length': String(100_000_001) } }),
        ),
      'video',
    );
    expect(erreur).toContain('depasse le plafond de 100000000 octets');
  });
});
