import { describe, expect, it } from 'vitest';
import imagesFixture from './fixtures/pexels-images.json' with { type: 'json' };
import videosFixture from './fixtures/pexels-videos.json' with { type: 'json' };
import { MEDIA_BACKGROUND_MAX_ZOOM, VERTICAL_9_16 } from '../src/config.ts';
import { toImageCandidates, toVideoCandidates } from '../src/pexels.ts';
import {
  coverScale,
  selectPexelsImage,
  selectPexelsVideo,
  selectPexelsVideoFile,
} from '../src/media-selection.ts';
import type { PexelsImageCandidate, PexelsVideoCandidate, PexelsVideoFile } from '../src/pexels.ts';

const CIBLE = VERTICAL_9_16;

const image = (id: number, width: number, height: number): PexelsImageCandidate => ({
  kind: 'image',
  id,
  width,
  height,
  sourceUrl: `https://www.pexels.com/photo/${id}/`,
  credit: { name: 'X', url: 'https://www.pexels.com/@x' },
  downloadUrl: `https://images.pexels.com/photos/${id}.jpeg`,
});

const fichier = (
  id: number,
  width: number,
  height: number,
  extra: Partial<PexelsVideoFile> = {},
): PexelsVideoFile => ({
  id,
  fileType: 'video/mp4',
  sizeInBytes: width * height * 10,
  width,
  height,
  fps: 30,
  link: `https://videos.pexels.com/video-files/${id}.mp4`,
  ...extra,
});

const video = (
  id: number,
  width: number,
  height: number,
  files: PexelsVideoFile[],
): PexelsVideoCandidate => ({
  kind: 'video',
  id,
  width,
  height,
  durationInSeconds: 10,
  sourceUrl: `https://www.pexels.com/video/${id}/`,
  credit: { name: 'X', url: 'https://www.pexels.com/@x' },
  files,
});

const permutations = <T>(items: readonly T[]): T[][] => [
  [...items],
  [...items].reverse(),
  [...items.slice(1), ...items.slice(0, 1)],
];

describe('coverScale', () => {
  it('vaut exactement 1 pour un portrait a la taille cible', () => {
    expect(coverScale(1080, 1920, CIBLE)).toBe(1);
  });

  it('est inferieur a 1 pour un portrait plus grand', () => {
    expect(coverScale(2160, 3840, CIBLE)).toBe(0.5);
    expect(coverScale(2240, 3360, CIBLE)).toBeCloseTo(0.5714, 4);
  });

  it('depasse 1 pour un paysage', () => {
    expect(coverScale(1600, 900, CIBLE)).toBeCloseTo(2.1333, 4);
  });

  it('depasse 1 pour un carre trop petit', () => {
    expect(coverScale(1200, 1200, CIBLE)).toBeCloseTo(1.6, 4);
  });

  it('depasse 1 pour un portrait trop petit', () => {
    expect(coverScale(540, 960, CIBLE)).toBe(2);
  });

  it('est deterministe', () => {
    const a = coverScale(3044, 4043, CIBLE);
    const b = coverScale(3044, 4043, CIBLE);
    expect(a).toBe(b);
  });
});

describe('selection image', () => {
  // 1080 x 1.25 = 1350 et 1920 x 1.25 = 2400 : la frontiere tombe sur des entiers exacts.
  const FRONTIERE = { width: 1350, height: 2400 };

  it('rejette tout candidat exigeant un agrandissement des le canvas', () => {
    const candidats = [image(1, 1080, 1919), image(2, 1600, 900), image(3, 1200, 1200)];
    expect(() => selectPexelsImage(candidats, CIBLE)).toThrow('Aucun candidat image exploitable');
    expect(() => selectPexelsImage(candidats, CIBLE)).toThrow('3 recus');
  });

  it('rejette une image qui couvre le canvas mais pas le zoom maximal', () => {
    expect(coverScale(1080, 1920, CIBLE)).toBe(1);
    expect(() => selectPexelsImage([image(1, 1080, 1920)], CIBLE)).toThrow(
      'Aucun candidat image exploitable',
    );
  });

  it('accepte exactement la frontiere du zoom maximal', () => {
    expect(coverScale(FRONTIERE.width, FRONTIERE.height, CIBLE) * MEDIA_BACKGROUND_MAX_ZOOM).toBe(
      1,
    );
    expect(selectPexelsImage([image(1, FRONTIERE.width, FRONTIERE.height)], CIBLE).id).toBe(1);
  });

  it('rejette juste sous la frontiere', () => {
    expect(() =>
      selectPexelsImage([image(1, FRONTIERE.width - 1, FRONTIERE.height)], CIBLE),
    ).toThrow('Aucun candidat image exploitable');
    expect(() =>
      selectPexelsImage([image(2, FRONTIERE.width, FRONTIERE.height - 1)], CIBLE),
    ).toThrow('Aucun candidat image exploitable');
  });

  it('accepte juste au-dessus de la frontiere', () => {
    expect(selectPexelsImage([image(1, FRONTIERE.width + 1, FRONTIERE.height + 1)], CIBLE).id).toBe(
      1,
    );
  });

  it('accepte une image largement suffisante', () => {
    expect(selectPexelsImage([image(1, 2160, 3840)], CIBLE).id).toBe(1);
  });

  it('prefere le ratio le plus proche du 9:16', () => {
    const proche = image(2, 1350, 2400);
    const loin = image(1, 3000, 4000);
    expect(selectPexelsImage([loin, proche], CIBLE).id).toBe(2);
    expect(selectPexelsImage([proche, loin], CIBLE).id).toBe(2);
  });

  it('a ratio egal, prefere la plus grande marge de resolution', () => {
    const juste = image(1, 1350, 2400);
    const ample = image(2, 2160, 3840);
    expect(selectPexelsImage([juste, ample], CIBLE).id).toBe(2);
    expect(selectPexelsImage([ample, juste], CIBLE).id).toBe(2);
  });

  it('departage par id quand tout est egal', () => {
    const a = image(7, 2160, 3840);
    const b = image(3, 2160, 3840);
    expect(selectPexelsImage([a, b], CIBLE).id).toBe(3);
    expect(selectPexelsImage([b, a], CIBLE).id).toBe(3);
  });

  it('donne le meme resultat quel que soit l ordre d entree', () => {
    const candidats = [
      image(5, 1350, 2400),
      image(2, 2160, 3840),
      image(9, 3000, 4000),
      image(1, 1440, 2560),
    ];
    const resultats = permutations(candidats).map((p) => selectPexelsImage(p, CIBLE).id);
    expect(new Set(resultats).size).toBe(1);
  });

  it('echoue explicitement sans candidat', () => {
    expect(() => selectPexelsImage([], CIBLE)).toThrow('Aucun candidat image recu');
  });

  it('selectionne parmi les candidats reels de la fixture', () => {
    const candidats = toImageCandidates(imagesFixture);
    const retenu = selectPexelsImage(candidats, CIBLE);
    expect(
      coverScale(retenu.width, retenu.height, CIBLE) * MEDIA_BACKGROUND_MAX_ZOOM,
    ).toBeLessThanOrEqual(1);
  });
});

describe('selection de variante video', () => {
  it('prefere 1080x1920 a 2160x3840', () => {
    const files = [fichier(1, 2160, 3840), fichier(2, 1080, 1920)];
    expect(selectPexelsVideoFile(files, CIBLE)?.id).toBe(2);
    expect(selectPexelsVideoFile([...files].reverse(), CIBLE)?.id).toBe(2);
  });

  it('ecarte une variante trop petite', () => {
    expect(selectPexelsVideoFile([fichier(1, 720, 1280)], CIBLE)).toBeNull();
    expect(selectPexelsVideoFile([fichier(1, 1080, 1919)], CIBLE)).toBeNull();
  });

  it('ecarte une variante trop volumineuse', () => {
    const enorme = fichier(1, 2160, 3840, { sizeInBytes: 100_000_001 });
    const limite = fichier(2, 2160, 3840, { sizeInBytes: 100_000_000 });
    expect(selectPexelsVideoFile([enorme], CIBLE)).toBeNull();
    expect(selectPexelsVideoFile([limite], CIBLE)?.id).toBe(2);
  });

  it('ecarte un type MIME non supporte', () => {
    expect(
      selectPexelsVideoFile([fichier(1, 1080, 1920, { fileType: 'video/webm' })], CIBLE),
    ).toBeNull();
    expect(
      selectPexelsVideoFile([fichier(2, 1080, 1920, { fileType: 'video/quicktime' })], CIBLE),
    ).toBeNull();
  });

  it('ne depend pas du fps', () => {
    const files = [
      fichier(1, 1080, 1920, { fps: 29.97 }),
      fichier(2, 1080, 1920, { fps: null }),
      fichier(3, 1080, 1920, { fps: 60 }),
    ];
    for (const p of permutations(files)) {
      expect(selectPexelsVideoFile(p, CIBLE)?.id).toBe(1);
    }
  });

  it('a resolution egale, prefere la plus petite taille puis l id', () => {
    const lourd = fichier(1, 1080, 1920, { sizeInBytes: 50_000_000 });
    const leger = fichier(2, 1080, 1920, { sizeInBytes: 20_000_000 });
    expect(selectPexelsVideoFile([lourd, leger], CIBLE)?.id).toBe(2);

    const memeTaille = [
      fichier(8, 1080, 1920, { sizeInBytes: 20_000_000 }),
      fichier(4, 1080, 1920, { sizeInBytes: 20_000_000 }),
    ];
    expect(selectPexelsVideoFile(memeTaille, CIBLE)?.id).toBe(4);
  });

  it('donne le meme resultat quel que soit l ordre des variantes', () => {
    const files = [
      fichier(3, 2160, 3840),
      fichier(1, 1080, 1920),
      fichier(5, 720, 1280),
      fichier(2, 1440, 2560),
    ];
    const resultats = permutations(files).map((p) => selectPexelsVideoFile(p, CIBLE)?.id);
    expect(new Set(resultats).size).toBe(1);
    expect(resultats[0]).toBe(1);
  });
});

describe('selection video', () => {
  it('echoue explicitement sans candidat', () => {
    expect(() => selectPexelsVideo([], CIBLE)).toThrow('Aucun candidat video recu');
  });

  it('echoue quand aucune video n a de variante exploitable', () => {
    const candidats = [
      video(1, 720, 1280, [fichier(11, 720, 1280)]),
      video(2, 1080, 1920, [fichier(21, 1080, 1920, { fileType: 'video/webm' })]),
    ];
    expect(() => selectPexelsVideo(candidats, CIBLE)).toThrow('Aucun candidat video exploitable');
    expect(() => selectPexelsVideo(candidats, CIBLE)).toThrow('2 recus');
  });

  it('ignore une video sans variante exploitable mais garde les autres', () => {
    const candidats = [
      video(1, 720, 1280, [fichier(11, 720, 1280)]),
      video(2, 1080, 1920, [fichier(21, 1080, 1920)]),
    ];
    const retenu = selectPexelsVideo(candidats, CIBLE);
    expect(retenu.candidate.id).toBe(2);
    expect(retenu.file.id).toBe(21);
  });

  it('retourne la video et la variante precise', () => {
    const candidats = [video(1, 2160, 3840, [fichier(11, 2160, 3840), fichier(12, 1080, 1920)])];
    const retenu = selectPexelsVideo(candidats, CIBLE);
    expect(retenu.candidate.id).toBe(1);
    expect(retenu.file.id).toBe(12);
  });

  it('prefere le ratio le plus proche du 9:16', () => {
    const exact = video(2, 1080, 1920, [fichier(21, 1080, 1920)]);
    const autre = video(1, 1500, 2000, [fichier(11, 1500, 2000)]);
    expect(selectPexelsVideo([autre, exact], CIBLE).candidate.id).toBe(2);
    expect(selectPexelsVideo([exact, autre], CIBLE).candidate.id).toBe(2);
  });

  it('donne le meme resultat quel que soit l ordre des videos', () => {
    const candidats = [
      video(9, 2160, 3840, [fichier(91, 2160, 3840)]),
      video(4, 1080, 1920, [fichier(41, 1080, 1920)]),
      video(7, 1440, 2560, [fichier(71, 1440, 2560), fichier(72, 1080, 1920)]),
    ];
    const resultats = permutations(candidats).map((p) => {
      const r = selectPexelsVideo(p, CIBLE);
      return `${r.candidate.id}/${r.file.id}`;
    });
    expect(new Set(resultats).size).toBe(1);
  });

  it('selectionne parmi les candidats reels de la fixture', () => {
    const candidats = toVideoCandidates(videosFixture);
    const retenu = selectPexelsVideo(candidats, CIBLE);
    expect(coverScale(retenu.file.width, retenu.file.height, CIBLE)).toBeLessThanOrEqual(1);
    expect(retenu.file.fileType).toBe('video/mp4');
  });
});
