import { MEDIA_BACKGROUND_MAX_ZOOM, type VideoFormat } from './config.ts';
import type { PexelsImageCandidate, PexelsVideoCandidate, PexelsVideoFile } from './pexels.ts';

const ACCEPTED_VIDEO_TYPE = 'video/mp4';
export const MAX_VARIANT_BYTES = 100_000_000;

export type SelectedVideo = { candidate: PexelsVideoCandidate; file: PexelsVideoFile };

export const coverScale = (width: number, height: number, target: VideoFormat): number =>
  Math.max(target.width / width, target.height / height);

const ratioDistance = (width: number, height: number, target: VideoFormat): number =>
  Math.abs(width / height - target.width / target.height);

const coversCanvas = (width: number, height: number, target: VideoFormat): boolean =>
  coverScale(width, height, target) <= 1;

const coversCanvasThroughZoom = (width: number, height: number, target: VideoFormat): boolean =>
  coverScale(width, height, target) * MEDIA_BACKGROUND_MAX_ZOOM <= 1;

const compareImages = (
  a: PexelsImageCandidate,
  b: PexelsImageCandidate,
  target: VideoFormat,
): number => {
  const ratio = ratioDistance(a.width, a.height, target) - ratioDistance(b.width, b.height, target);
  if (ratio !== 0) return ratio;

  const headroom = coverScale(a.width, a.height, target) - coverScale(b.width, b.height, target);
  if (headroom !== 0) return headroom;

  return a.id - b.id;
};

const compareFiles = (a: PexelsVideoFile, b: PexelsVideoFile, target: VideoFormat): number => {
  const closeness = coverScale(b.width, b.height, target) - coverScale(a.width, a.height, target);
  if (closeness !== 0) return closeness;

  const size = a.sizeInBytes - b.sizeInBytes;
  if (size !== 0) return size;

  return a.id - b.id;
};

const compareVideos = (a: SelectedVideo, b: SelectedVideo, target: VideoFormat): number => {
  const ratio =
    ratioDistance(a.candidate.width, a.candidate.height, target) -
    ratioDistance(b.candidate.width, b.candidate.height, target);
  if (ratio !== 0) return ratio;

  const closeness =
    coverScale(b.file.width, b.file.height, target) -
    coverScale(a.file.width, a.file.height, target);
  if (closeness !== 0) return closeness;

  return a.candidate.id - b.candidate.id;
};

export const selectPexelsVideoFile = (
  files: readonly PexelsVideoFile[],
  target: VideoFormat,
): PexelsVideoFile | null => {
  const usable = files.filter(
    (file) =>
      file.fileType === ACCEPTED_VIDEO_TYPE &&
      file.sizeInBytes <= MAX_VARIANT_BYTES &&
      coversCanvas(file.width, file.height, target),
  );

  if (usable.length === 0) return null;

  return usable.reduce((best, file) => (compareFiles(file, best, target) < 0 ? file : best));
};

export const selectPexelsImage = (
  candidates: readonly PexelsImageCandidate[],
  target: VideoFormat,
): PexelsImageCandidate => {
  if (candidates.length === 0) {
    throw new Error('Aucun candidat image recu');
  }

  const usable = candidates.filter((candidate) =>
    coversCanvasThroughZoom(candidate.width, candidate.height, target),
  );

  if (usable.length === 0) {
    throw new Error(
      `Aucun candidat image exploitable : ${candidates.length} recus, ` +
        `aucun ne couvre ${target.width}x${target.height} sans agrandissement ` +
        `jusqu'au zoom ${MEDIA_BACKGROUND_MAX_ZOOM}`,
    );
  }

  return usable.reduce((best, candidate) =>
    compareImages(candidate, best, target) < 0 ? candidate : best,
  );
};

export const selectPexelsVideo = (
  candidates: readonly PexelsVideoCandidate[],
  target: VideoFormat,
): SelectedVideo => {
  if (candidates.length === 0) {
    throw new Error('Aucun candidat video recu');
  }

  const usable: SelectedVideo[] = [];
  for (const candidate of candidates) {
    const file = selectPexelsVideoFile(candidate.files, target);
    if (file !== null) usable.push({ candidate, file });
  }

  if (usable.length === 0) {
    throw new Error(
      `Aucun candidat video exploitable : ${candidates.length} recus, ` +
        `aucune variante ${ACCEPTED_VIDEO_TYPE} couvrant ${target.width}x${target.height} ` +
        `sans agrandissement et sous ${MAX_VARIANT_BYTES / 1_000_000} Mo`,
    );
  }

  return usable.reduce((best, entry) => (compareVideos(entry, best, target) < 0 ? entry : best));
};
