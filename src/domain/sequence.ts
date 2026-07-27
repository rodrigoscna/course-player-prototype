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
