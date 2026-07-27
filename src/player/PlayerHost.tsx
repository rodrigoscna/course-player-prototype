import { useSyncExternalStore, type ReactNode } from 'react';
import { lessonPath } from '../domain/selectors';
import {
  courseForItem,
  itemById,
  nextPlayableAfter,
  prevPlayableBefore,
  unlockablesAfter,
  videoForLesson,
} from '../store/courseData';
import { progressStore } from '../store/progressStore';
import { videoPositionStore } from '../store/videoPositionStore';
import { installPlayerProbe } from '../dev/playerProbe';
import { controller, type PlayerSnapshot } from './playerController';
import { getPlayer } from './playerSingleton';

/**
 * Wiring the controller to the stores needs no React state, so it happens once
 * at module scope. That keeps it out of render entirely and makes StrictMode's
 * double invoke irrelevant.
 */
controller.configure({
  nextLessonFor: (lessonId) => {
    const lesson = itemById(lessonId);
    return lesson ? nextPlayableAfter(lesson) : null;
  },
  prevLessonFor: (lessonId) => {
    const lesson = itemById(lessonId);
    return lesson ? prevPlayableBefore(lesson) : null;
  },
  videoFor: (lesson) => videoForLesson(lesson),
  courseFor: (lesson) => courseForItem(lesson),
  lessonPath,
  onLessonStarted: (lessonId) => {
    const lesson = itemById(lessonId);
    if (lesson) progressStore.markViewed(lesson.space_id, lesson.id);
  },
  onLessonCompleted: (lessonId) => {
    const lesson = itemById(lessonId);
    if (!lesson) return;
    progressStore.markCompleted(lesson.space_id, lesson.id);
    // Positions are saved continuously, so a finished lesson's last saved
    // position is its end. Clearing it means replaying the lesson starts over
    // instead of resuming at the end and immediately advancing again.
    if (lesson.trigger_complete_video_id !== null) {
      videoPositionStore.clear(lesson.id, lesson.trigger_complete_video_id);
    }
    // Unlocks the next playable lesson *and* any section or quiz standing between
    // here and it. Unlocking only what plays next would leave those gated forever,
    // since nothing in the playback chain ever points at them.
    unlockablesAfter(lesson).forEach((item) =>
      progressStore.unlock(item.space_id, item.id),
    );
  },
  resumePositionFor: (lessonId, videoId) => videoPositionStore.get(lessonId, videoId),
  savePosition: (lessonId, videoId, seconds) =>
    videoPositionStore.save(lessonId, videoId, seconds),
});

installPlayerProbe(getPlayer().player);

/**
 * Owns the single player for the whole session.
 *
 * Deliberately mounted outside the router rather than in a root route element:
 * a route element does persist across child navigations today, but keeping the
 * host above the router means no future route arrangement can unmount it.
 */
export function PlayerHost({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Reactive view of player state for components that need it. */
export function usePlayerSnapshot(): PlayerSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}

/** Re-renders when progress changes. */
export function useProgressVersion(): number {
  return useSyncExternalStore(progressStore.subscribe, progressStore.getVersion);
}
