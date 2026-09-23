import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalSrc, fileSha256, normalizeAsset } from '../src/media-normalize.ts';

const SHA_TRENDFORGE = 'cabe975567f5b6323607d7e106a29128bbda62386c712f925dd4f3fee9774c02';

const dossier = async () => mkdtemp(path.join(tmpdir(), 'tf-norm-'));

describe('empreinte d un fichier', () => {
  it('rend le SHA-256 connu d un contenu connu', async () => {
    const racine = await dossier();
    try {
      const fichier = path.join(racine, 'a.txt');
      await writeFile(fichier, 'trendforge', 'utf8');
      expect(await fileSha256(fichier)).toBe(SHA_TRENDFORGE);
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });

  it('rend deux fois la meme empreinte', async () => {
    const racine = await dossier();
    try {
      const fichier = path.join(racine, 'a.txt');
      await writeFile(fichier, 'trendforge', 'utf8');
      expect(await fileSha256(fichier)).toBe(await fileSha256(fichier));
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });

  it('distingue deux contenus differents', async () => {
    const racine = await dossier();
    try {
      await writeFile(path.join(racine, 'a.txt'), 'trendforge', 'utf8');
      await writeFile(path.join(racine, 'b.txt'), 'trendforgE', 'utf8');
      expect(await fileSha256(path.join(racine, 'a.txt'))).not.toBe(
        await fileSha256(path.join(racine, 'b.txt')),
      );
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });

  it('echoue sur un fichier absent', async () => {
    const racine = await dossier();
    try {
      await expect(fileSha256(path.join(racine, 'absent.txt'))).rejects.toThrow();
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });
});

describe('chemin canonique', () => {
  const assets = path.join('C:', 'projet', 'assets');

  it('rend un chemin relatif a assets/ en separateurs POSIX', () => {
    expect(canonicalSrc(path.join(assets, 'generated', 'media', 'a.jpg'), assets)).toBe(
      'generated/media/a.jpg',
    );
  });

  it('accepte un fichier a la racine de assets/', () => {
    expect(canonicalSrc(path.join(assets, 'a.jpg'), assets)).toBe('a.jpg');
  });

  it('refuse un chemin hors de assets/', () => {
    expect(() => canonicalSrc(path.join('C:', 'projet', 'secret.jpg'), assets)).toThrow(
      'hors de assets/',
    );
    expect(() => canonicalSrc(path.join(assets, '..', 'secret.jpg'), assets)).toThrow(
      'hors de assets/',
    );
  });

  it('refuse un prefixe trompeur', () => {
    expect(() => canonicalSrc(path.join('C:', 'projet', 'assets-prive', 'a.jpg'), assets)).toThrow(
      'hors de assets/',
    );
  });

  it('produit un src compatible avec le contrat media local', () => {
    const src = canonicalSrc(path.join(assets, 'generated', 'media', 'pexels-image-1.jpg'), assets);
    expect(src).toMatch(/^[a-z0-9][a-z0-9/_-]*\.(?:jpe?g|png|webp)$/);
  });
});

describe('normalisation : garde-fous', () => {
  it('refuse un asset telecharge introuvable', async () => {
    const racine = await dossier();
    try {
      await expect(
        normalizeAsset({
          asset: {
            kind: 'image',
            path: path.join(racine, 'absent.jpg'),
            sha256: 'a'.repeat(64),
            sizeInBytes: 10,
            width: 100,
            height: 200,
            format: 'jpeg',
          },
          baseName: 'pexels-image-1',
          assetsDir: racine,
        }),
      ).rejects.toThrow('Asset telecharge introuvable');
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });
});
