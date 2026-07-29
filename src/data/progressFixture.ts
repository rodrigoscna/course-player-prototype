import type { ProgressPayload } from '../types/coursework';

/**
 * Progress is its own payload in production, not fields on the coursework
 * items — keeping that split is what lets this prototype map back cleanly.
 *
 * Course A starts partway through so the table of contents shows all four
 * indicator states at once (completed, viewed, current, locked).
 */
export const progressBySpaceId: Record<number, ProgressPayload> = {
  101: {
    lesson_progress: {
      1001: 'completed',
      1002: 'completed',
      1004: 'viewed',
    },
    unlocked_lesson_ids: [1001, 1002, 1003, 1004, 1005],
    current: 1004,
    next_coursework_id: 1005,
  },
  102: {
    lesson_progress: {},
    // Nothing is gated in this course, so everything is unlocked.
    unlocked_lesson_ids: [2001, 2002, 2003, 2004, 2005],
    current: 2002,
    next_coursework_id: 2003,
  },
};
