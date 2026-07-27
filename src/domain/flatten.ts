import type { CourseworkItem, NestedCoursework } from '../types/coursework';

/**
 * Depth-first order, the linear sequence a continuous player walks.
 *
 * `flat(Infinity)` is the equivalent of the backend's `.flatten` on the same
 * nested array, so the two representations stay in lockstep. It goes through
 * `unknown[]` because TypeScript cannot resolve `flat` against the recursive
 * nested type — the runtime behavior is exactly the same.
 */
export function flatten(nested: NestedCoursework): CourseworkItem[] {
  return (nested as unknown[]).flat(Infinity) as CourseworkItem[];
}
