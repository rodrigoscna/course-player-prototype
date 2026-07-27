import { progressBySpaceId } from '../data/progressFixture';
import type { ProgressPayload } from '../types/coursework';

/**
 * Progress lives in its own store because it is its own payload on the server.
 * Mutations are local-only in the prototype.
 */

const progress: Record<number, ProgressPayload> = structuredClone(progressBySpaceId);
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

export const progressStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Version counter so `useSyncExternalStore` sees a stable, changing value. */
  getVersion(): number {
    return version;
  },

  forSpace(spaceId: number): ProgressPayload {
    progress[spaceId] ??= {
      lesson_progress: {},
      unlocked_lesson_ids: [],
      current: null,
      next_coursework_id: null,
    };
    return progress[spaceId];
  },

  markViewed(spaceId: number, lessonId: number): void {
    const payload = progressStore.forSpace(spaceId);
    payload.current = lessonId;
    // Never downgrade a completed lesson back to viewed.
    if (payload.lesson_progress[lessonId] !== 'completed') {
      payload.lesson_progress[lessonId] = 'viewed';
    }
    notify();
  },

  markCompleted(spaceId: number, lessonId: number): void {
    const payload = progressStore.forSpace(spaceId);
    payload.lesson_progress[lessonId] = 'completed';
    notify();
  },

  unlock(spaceId: number, lessonId: number): void {
    const payload = progressStore.forSpace(spaceId);
    if (!payload.unlocked_lesson_ids.includes(lessonId)) {
      payload.unlocked_lesson_ids.push(lessonId);
      notify();
    }
  },

  reset(spaceId: number): void {
    progress[spaceId] = structuredClone(progressBySpaceId[spaceId]);
    notify();
  },
};
