import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkEntryFile,
  emptyLock,
  mediaLockKey,
  parseMediaLock,
  readMediaLock,
  serializeMediaLock,
  writeMediaLock,
  type MediaLock,
  type MediaLockEntry,
} from '../src/media-lock.ts';
import { fileSha256 } from '../src/media-normalize.ts';

const IMAGE: MediaLockEntry = {
  provider: 'pexels',
  kind: 'image',
  query: 'forest fog',
  providerAssetId: '28106442',
  sourcePage: 'https://www.pexels.com/photo/28106442/',
  credit: { name: 'Alex Dupont', url: 'https://www.pexels.com/@alex-dupont' },
  src: 'generated/media/pexels-image-28106442.jpg',
  sha256: 'a'.repeat(64),
  width: 2252,
  height: 4000,
  format: 'jpeg',
};

const VIDEO: MediaLockEntry = {
  provider: 'pexels',
  kind: 'video',
  query: 'city night',
  providerAssetId: '10931206',
  providerVariantId: '4807624',
  sourcePage: 'https://www.pexels.com/video/10931206/',
  credit: { name: 'Vera', url: 'https://www.pexels.com/@vera' },
  src: 'generated/media/pexels-video-10931206-4807624.mp4',
  sha256: 'b'.repeat(64),
  width: 1080,
  height: 1920,
  durationInSeconds: 10.541667,
};

const dossier = async () => mkdtemp(path.join(tmpdir(), 'tf-lock-'));

describe('cle de lock', () => {
  it('derive la cle du type et de la requete', () => {
    expect(mediaLockKey({ kind: 'image', query: 'forest fog' })).toBe('image:forest fog');
    expect(mediaLockKey({ kind: 'video', query: 'city night' })).toBe('video:city night');
  });

  it('est stable malgre la casse et les espaces', () => {
    const attendu = 'image:forest fog';
    expect(mediaLockKey({ kind: 'image', query: '  Forest Fog  ' })).toBe(attendu);
    expect(mediaLockKey({ kind: 'image', query: 'FOREST FOG' })).toBe(attendu);
  });

  it('distingue les types pour une meme requete', () => {
    expect(mediaLockKey({ kind: 'image', query: 'x y' })).not.toBe(
      mediaLockKey({ kind: 'video', query: 'x y' }),
    );
  });
});

describe('lecture du lock', () => {
  const lock: MediaLock = { version: 1, entries: { 'image:forest fog': IMAGE } };

  it('accepte un lock valide', () => {
    expect(parseMediaLock(serializeMediaLock(lock))).toEqual(lock);
  });

  it('refuse un JSON illisible', () => {
    expect(() => parseMediaLock('{ pas du json')).toThrow('JSON illisible');
  });

  it('refuse une version inconnue', () => {
    expect(() => parseMediaLock(JSON.stringify({ version: 2, entries: {} }))).toThrow(
      'contenu invalide',
    );
  });

  it('refuse une entree incomplete', () => {
    const sansHash: Record<string, unknown> = { ...IMAGE };
    delete sansHash['sha256'];
    expect(() => parseMediaLock(JSON.stringify({ version: 1, entries: { a: sansHash } }))).toThrow(
      'contenu invalide',
    );
  });

  it('refuse un sha256 mal forme', () => {
    const mauvais = { ...IMAGE, sha256: 'xyz' };
    expect(() => parseMediaLock(JSON.stringify({ version: 1, entries: { a: mauvais } }))).toThrow(
      'contenu invalide',
    );
  });

  it('refuse une URL de source invalide', () => {
    const mauvais = { ...IMAGE, sourcePage: 'pas-une-url' };
    expect(() => parseMediaLock(JSON.stringify({ version: 1, entries: { a: mauvais } }))).toThrow(
      'contenu invalide',
    );
  });

  it('refuse un champ parasite', () => {
    const intrus = { ...IMAGE, cdnUrl: 'https://images.pexels.com/x.jpg' };
    expect(() => parseMediaLock(JSON.stringify({ version: 1, entries: { a: intrus } }))).toThrow(
      'contenu invalide',
    );
  });

  it('exige providerVariantId sur une video', () => {
    const sansVariante: Record<string, unknown> = { ...VIDEO };
    delete sansVariante['providerVariantId'];
    expect(() =>
      parseMediaLock(JSON.stringify({ version: 1, entries: { a: sansVariante } })),
    ).toThrow('contenu invalide');
  });
});

describe('serialisation deterministe', () => {
  it('trie les entrees quel que soit l ordre d insertion', () => {
    const a: MediaLock = {
      version: 1,
      entries: { 'video:city night': VIDEO, 'image:forest fog': IMAGE },
    };
    const b: MediaLock = {
      version: 1,
      entries: { 'image:forest fog': IMAGE, 'video:city night': VIDEO },
    };
    expect(serializeMediaLock(a)).toBe(serializeMediaLock(b));
  });

  it('produit deux fois le meme texte', () => {
    const lock: MediaLock = { version: 1, entries: { 'image:forest fog': IMAGE } };
    expect(serializeMediaLock(lock)).toBe(serializeMediaLock(lock));
  });

  it('reste identique apres un aller-retour lecture/ecriture', () => {
    const lock: MediaLock = {
      version: 1,
      entries: { 'image:forest fog': IMAGE, 'video:city night': VIDEO },
    };
    const premier = serializeMediaLock(lock);
    const second = serializeMediaLock(parseMediaLock(premier));
    const troisieme = serializeMediaLock(parseMediaLock(second));
    expect(second).toBe(premier);
    expect(troisieme).toBe(premier);
  });

  it('ne depend pas de l ordre de construction des champs', () => {
    const desordre = {
      durationInSeconds: VIDEO.durationInSeconds,
      sha256: VIDEO.sha256,
      kind: VIDEO.kind,
      provider: VIDEO.provider,
      height: VIDEO.height,
      width: VIDEO.width,
      src: VIDEO.src,
      credit: VIDEO.credit,
      sourcePage: VIDEO.sourcePage,
      providerVariantId: VIDEO.providerVariantId,
      providerAssetId: VIDEO.providerAssetId,
      query: VIDEO.query,
    };
    expect(serializeMediaLock({ version: 1, entries: { a: desordre } })).toBe(
      serializeMediaLock({ version: 1, entries: { a: VIDEO } }),
    );
  });

  it('se termine par une newline et utilise une indentation de deux espaces', () => {
    const texte = serializeMediaLock({ version: 1, entries: { a: IMAGE } });
    expect(texte.endsWith('\n')).toBe(true);
    expect(texte).toContain('\n  "version": 1');
  });
});

describe('ecriture du lock', () => {
  it('ecrit puis relit un lock identique', async () => {
    const racine = await dossier();
    try {
      const fichier = path.join(racine, 'media-lock.json');
      const lock: MediaLock = {
        version: 1,
        entries: { 'image:forest fog': IMAGE, 'video:city night': VIDEO },
      };
      await writeMediaLock(fichier, lock);
      expect(await readMediaLock(fichier)).toEqual(lock);
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });

  it('ne laisse aucun fichier temporaire', async () => {
    const racine = await dossier();
    try {
      const fichier = path.join(racine, 'media-lock.json');
      await writeMediaLock(fichier, { version: 1, entries: { a: IMAGE } });
      expect(await readdir(racine)).toEqual(['media-lock.json']);
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });

  it('rend un lock vide quand le fichier n existe pas', async () => {
    const racine = await dossier();
    try {
      expect(await readMediaLock(path.join(racine, 'absent.json'))).toEqual(emptyLock());
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });

  it('remplace le contenu precedent sans residu', async () => {
    const racine = await dossier();
    try {
      const fichier = path.join(racine, 'media-lock.json');
      await writeMediaLock(fichier, { version: 1, entries: { a: IMAGE } });
      await writeMediaLock(fichier, { version: 1, entries: { b: VIDEO } });
      const relu = await readMediaLock(fichier);
      expect(Object.keys(relu.entries)).toEqual(['b']);
      expect(await readdir(racine)).toEqual(['media-lock.json']);
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });
});

describe('integrite du fichier local', () => {
  const CONTENU = 'trendforge';

  it('signale un fichier absent', async () => {
    const racine = await dossier();
    try {
      expect(await checkEntryFile(IMAGE, racine)).toBe('absent');
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });

  it('signale un fichier altere', async () => {
    const racine = await dossier();
    try {
      const cible = path.join(racine, 'a.jpg');
      await writeFile(cible, CONTENU, 'utf8');
      expect(await checkEntryFile({ ...IMAGE, src: 'a.jpg' }, racine)).toBe('altere');
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });

  it('valide un fichier dont le hash correspond', async () => {
    const racine = await dossier();
    try {
      const cible = path.join(racine, 'a.jpg');
      await writeFile(cible, CONTENU, 'utf8');
      const attendu = await fileSha256(cible);
      expect(await checkEntryFile({ ...IMAGE, src: 'a.jpg', sha256: attendu }, racine)).toBe('ok');
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });
});
