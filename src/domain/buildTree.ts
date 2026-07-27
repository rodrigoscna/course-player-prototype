import type { CourseworkItem, CourseworkNode, CourseworkStatus } from '../types/coursework';

export interface CourseworkTree {
  /** Root nodes for the course — in practice the single overview. */
  roots: CourseworkNode[];
  byId: Map<number, CourseworkItem>;
}

interface BuildTreeOptions {
  spaceId: number;
  /** Statuses a member is allowed to see. Hosts would also pass 'hidden'. */
  includeStatuses?: CourseworkStatus[];
}

/**
 * Turns the flat content payload into a tree, the same way the real client does.
 *
 * Siblings are sorted within their own bucket only. A global sort would be
 * wrong: `position` is scoped to a parent, so items from different parents can
 * share a position and would interleave.
 */
export function buildTree(
  items: CourseworkItem[],
  { spaceId, includeStatuses = ['posted'] }: BuildTreeOptions,
): CourseworkTree {
  const visible = items.filter(
    (item) => item.space_id === spaceId && includeStatuses.includes(item.status),
  );

  const byId = new Map<number, CourseworkItem>();
  visible.forEach((item) => byId.set(item.id, item));

  const childrenOf = new Map<number | null, CourseworkItem[]>();
  visible.forEach((item) => {
    // An item whose parent was filtered out is dropped rather than promoted to
    // a root, matching the real client.
    const parentMissing = item.parent_id !== null && !byId.has(item.parent_id);
    if (parentMissing) return;

    const siblings = childrenOf.get(item.parent_id) ?? [];
    siblings.push(item);
    childrenOf.set(item.parent_id, siblings);
  });

  childrenOf.forEach((siblings) =>
    siblings.sort((a, b) => a.position - b.position || a.id - b.id),
  );

  const toNode = (item: CourseworkItem): CourseworkNode => ({
    item,
    children: (childrenOf.get(item.id) ?? []).map(toNode),
  });

  return { roots: (childrenOf.get(null) ?? []).map(toNode), byId };
}
