import type { CourseworkNode, NestedCoursework } from '../types/coursework';

/**
 * Builds production's nested structure, where a leaf is `[item]` and a branch is
 * `[item, [...children]]`. For a course of overview 1, lesson 2, section 3
 * (children 4, 5), section 6 (child 7) and lesson 8 this produces:
 *
 *   [[1], [2], [3, [4, 5]], [6, [7]], [8]]
 *
 * The table of contents renders this shape directly, since the nesting is the
 * UI. Flattening it gives playback order.
 */
export function nest(nodes: CourseworkNode[]): NestedCoursework {
  return nodes.map((node) =>
    node.children.length === 0
      ? [node.item]
      : [node.item, nest(node.children)],
  );
}
