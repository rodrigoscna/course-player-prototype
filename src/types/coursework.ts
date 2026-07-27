/**
 * Mirrors the production coursework wire shape.
 *
 * There is no Course or Section entity: a course is a container (space), and
 * sections, lessons and quizzes are all the same record type in a
 * self-referential tree, discriminated by `prompt_type`. The tree is at most
 * three levels deep (overview → section → lesson/quiz), and `position` orders
 * an item only among its own siblings.
 */

export type CourseworkPromptType =
  | 'course_overview'
  | 'course_section'
  | 'course_lesson'
  | 'course_quiz';

export type CourseworkStatus = 'posted' | 'hidden' | 'pending';

export type CompletionCriteria =
  | 'none'
  | 'visited'
  | 'button'
  | 'video'
  | 'minimum_correct_percentage';

export type UnlockingCriteria =
  | 'none'
  | 'sequential'
  | 'time_from_course_join'
  | 'scheduled_date';

export interface CourseworkItem {
  id: number;
  /** The course this item belongs to. */
  space_id: number;
  /** Null only for the course overview. */
  parent_id: number | null;
  /** Sort order among siblings only — never compare across parents. */
  position: number;
  prompt_type: CourseworkPromptType;
  status: CourseworkStatus;
  title: string;
  description: string;
  slug: string;
  image_url: string;
  is_video: boolean;
  completion_criteria: CompletionCriteria;
  unlocking_criteria: UnlockingCriteria;
  /**
   * Which video gates completion. The URL is not on the coursework record —
   * look it up in the separate videos payload.
   */
  trigger_complete_video_id: number | null;
}

export interface Course {
  space_id: number;
  slug: string;
  title: string;
  description: string;
}

export interface VideoRecord {
  id: number;
  url: string;
  type: string;
  duration_seconds: number;
  /**
   * Demo-only: treat the clip as finished at this offset so a whole course
   * plays through in under a minute. Routed through the same guarded advance
   * as a real `ended`.
   */
  demo_end_at_seconds?: number;
  /**
   * Audio-first content, which the floating player shows in its small state
   * because there is nothing worth watching. Production carries real audio
   * assets; here it is a flag on an ordinary clip so the state is reachable.
   */
  audio_only?: boolean;
}

/** A separate payload in production, deliberately kept separate here. */
export interface ProgressPayload {
  lesson_progress: Record<number, 'viewed' | 'completed'>;
  unlocked_lesson_ids: number[];
  current: number | null;
  next_coursework_id: number | null;
}

/** Resume positions, keyed `${post_id}:${video_id}` — the production key. */
export type VideoPositions = Record<string, number>;

/** A coursework item with its children resolved. */
export interface CourseworkNode {
  item: CourseworkItem;
  children: CourseworkNode[];
}

/**
 * Production-parity nested structure: a leaf is `[item]`, a branch is
 * `[item, [...children]]`. Flattening it depth-first gives playback order.
 */
export type NestedCoursework = Array<CourseworkItem | NestedCoursework>;
