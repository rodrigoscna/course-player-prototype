import type { CourseworkItem } from '../types/coursework';

/**
 * Whether an item is a lesson the player can actually play. Overviews, sections
 * and quizzes are part of the tree but not part of the playback chain, so the
 * player steps over them.
 */
export function isVideoLesson(item: CourseworkItem): boolean {
  return (
    item.prompt_type === 'course_lesson' &&
    item.is_video &&
    item.trigger_complete_video_id !== null
  );
}

/** The playback order: depth-first, video-bearing lessons only. */
export function videoLessons(flatSequence: CourseworkItem[]): CourseworkItem[] {
  return flatSequence.filter(isVideoLesson);
}

export function positionInSequence(
  flatSequence: CourseworkItem[],
  lessonId: number,
): number {
  return videoLessons(flatSequence).findIndex((item) => item.id === lessonId);
}

/**
 * The next playable lesson after `lessonId`, or null at the end of the course.
 *
 * Deliberately never crosses into another course: rolling into an unrelated
 * course is disorienting, and "course complete" is the more honest end state.
 */
export function nextVideoLesson(
  flatSequence: CourseworkItem[],
  lessonId: number,
): CourseworkItem | null {
  const playable = videoLessons(flatSequence);
  const index = playable.findIndex((item) => item.id === lessonId);
  if (index === -1) return null;
  return playable[index + 1] ?? null;
}

export function prevVideoLesson(
  flatSequence: CourseworkItem[],
  lessonId: number,
): CourseworkItem | null {
  const playable = videoLessons(flatSequence);
  const index = playable.findIndex((item) => item.id === lessonId);
  if (index <= 0) return null;
  return playable[index - 1] ?? null;
}

/**
 * Everything that finishing `lessonId` should unlock: each item in depth-first
 * order after it, up to and including the next playable lesson.
 *
 * Deliberately walks the full sequence rather than the playback chain. Sections
 * and quizzes sit in the table of contents but never enter the chain, so
 * unlocking only what plays next leaves them gated permanently — a quiz that can
 * never be opened, no matter how much of the course is finished.
 *
 * Stopping *after* the next playable lesson is what keeps this from unlocking the
 * rest of the course: it hands over one more thing to watch, plus whatever
 * non-playable items stand between here and there. Those items are released
 * rather than waited on because this prototype has no way to complete a quiz, and
 * gating playback behind one would strand every lesson past it.
 */
export function itemsToUnlockAfter(
  flatSequence: CourseworkItem[],
  lessonId: number,
): CourseworkItem[] {
  const index = flatSequence.findIndex((item) => item.id === lessonId);
  if (index === -1) return [];

  const unlockable: CourseworkItem[] = [];
  for (const item of flatSequence.slice(index + 1)) {
    unlockable.push(item);
    if (isVideoLesson(item)) break;
  }
  return unlockable;
}
