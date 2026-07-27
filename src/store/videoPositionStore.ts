import { positionKey, videoPositions } from '../data/videoPositionsFixture';

/**
 * Resume positions, keyed by lesson and video together — the production key,
 * since one lesson can hold more than one video.
 */

const positions: Record<string, number> = { ...videoPositions };

/** Only write once a second; `timeupdate` fires several times per second. */
const WRITE_INTERVAL_MS = 1000;
let lastWriteAt = 0;

export const videoPositionStore = {
  get(lessonId: number, videoId: number): number {
    return positions[positionKey(lessonId, videoId)] ?? 0;
  },

  save(lessonId: number, videoId: number, seconds: number): void {
    const now = Date.now();
    if (now - lastWriteAt < WRITE_INTERVAL_MS) return;
    lastWriteAt = now;
    positions[positionKey(lessonId, videoId)] = seconds;
  },

  clear(lessonId: number, videoId: number): void {
    delete positions[positionKey(lessonId, videoId)];
  },
};
