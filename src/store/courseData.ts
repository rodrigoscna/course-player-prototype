import { courses, courseworkItems } from '../data/courseworkFixture';
import { videoById } from '../data/videosFixture';
import { buildTree } from '../domain/buildTree';
import { flatten } from '../domain/flatten';
import { nest } from '../domain/nest';
import {
  itemsToUnlockAfter,
  nextVideoLesson,
  prevVideoLesson,
  videoLessons,
} from '../domain/sequence';
import type {
  Course,
  CourseworkItem,
  CourseworkNode,
  NestedCoursework,
} from '../types/coursework';

export interface CourseData {
  course: Course;
  roots: CourseworkNode[];
  /** What the table of contents renders. */
  nested: NestedCoursework;
  /** Depth-first order of every item. */
  flat: CourseworkItem[];
  /** Depth-first order of playable lessons only. */
  playable: CourseworkItem[];
}

// Derivations are pure and the fixtures never change, so one cache is enough.
const cache = new Map<number, CourseData>();

export function courseDataFor(spaceId: number): CourseData | null {
  const cached = cache.get(spaceId);
  if (cached) return cached;

  const course = courses.find((candidate) => candidate.space_id === spaceId);
  if (!course) return null;

  const { roots } = buildTree(courseworkItems, { spaceId });
  const nested = nest(roots);
  const flat = flatten(nested);
  const data: CourseData = { course, roots, nested, flat, playable: videoLessons(flat) };

  cache.set(spaceId, data);
  return data;
}

export function courseDataBySlug(slug: string | undefined): CourseData | null {
  const course = courses.find((candidate) => candidate.slug === slug);
  return course ? courseDataFor(course.space_id) : null;
}

export function allCourses(): Course[] {
  return courses;
}

// Every item across every course, so a component holding only an id can resolve
// it without knowing which course it came from.
const itemsById = new Map<number, CourseworkItem>(
  courseworkItems.map((item) => [item.id, item]),
);

export function itemById(id: number | null | undefined): CourseworkItem | null {
  return id == null ? null : itemsById.get(id) ?? null;
}

/** The course an item belongs to, resolved through its `space_id`. */
export function courseForItem(item: CourseworkItem): Course | null {
  return courses.find((course) => course.space_id === item.space_id) ?? null;
}

export function nextPlayableAfter(item: CourseworkItem): CourseworkItem | null {
  const data = courseDataFor(item.space_id);
  return data ? nextVideoLesson(data.flat, item.id) : null;
}

export function prevPlayableBefore(item: CourseworkItem): CourseworkItem | null {
  const data = courseDataFor(item.space_id);
  return data ? prevVideoLesson(data.flat, item.id) : null;
}

/** What completing `item` releases — see `itemsToUnlockAfter`. */
export function unlockablesAfter(item: CourseworkItem): CourseworkItem[] {
  const data = courseDataFor(item.space_id);
  return data ? itemsToUnlockAfter(data.flat, item.id) : [];
}

export function videoForLesson(item: CourseworkItem) {
  return videoById(item.trigger_complete_video_id);
}
