import type { Course, CourseworkItem, ProgressPayload } from '../types/coursework';

export function courseBySlug(courses: Course[], slug: string | undefined): Course | null {
  return courses.find((course) => course.slug === slug) ?? null;
}

export function lessonBySlug(
  items: CourseworkItem[],
  slug: string | undefined,
): CourseworkItem | null {
  return items.find((item) => item.slug === slug) ?? null;
}

export function lessonPath(course: Course, item: CourseworkItem): string {
  return `/courses/${course.slug}/lessons/${item.slug}`;
}

/**
 * Locked items are navigable in name only — the table of contents disables them.
 * Only `sequential` unlocking gates anything in this prototype; the other real
 * criteria (scheduled dates, time from join) would read the same payload.
 */
export function isLocked(item: CourseworkItem, progress: ProgressPayload): boolean {
  if (item.unlocking_criteria === 'none') return false;
  return !progress.unlocked_lesson_ids.includes(item.id);
}

export function isCompleted(item: CourseworkItem, progress: ProgressPayload): boolean {
  return progress.lesson_progress[item.id] === 'completed';
}

export function isViewed(item: CourseworkItem, progress: ProgressPayload): boolean {
  return progress.lesson_progress[item.id] === 'viewed';
}
