import { describe, expect, it } from 'vitest';
import { courseworkItems } from '../../data/courseworkFixture';
import { buildTree } from '../buildTree';
import { flatten } from '../flatten';
import { nest } from '../nest';
import {
  itemsToUnlockAfter,
  nextVideoLesson,
  prevVideoLesson,
  videoLessons,
} from '../sequence';
import type { CourseworkItem, NestedCoursework } from '../../types/coursework';

const ids = (items: CourseworkItem[]) => items.map((item) => item.id);

/** Collapses the nested structure to ids so the exact shape can be asserted. */
const nestedIds = (nested: NestedCoursework): unknown[] =>
  nested.map((entry) =>
    Array.isArray(entry) ? nestedIds(entry) : (entry as CourseworkItem).id,
  );

const treeFor = (spaceId: number) => buildTree(courseworkItems, { spaceId });
const flatFor = (spaceId: number) => flatten(nest(treeFor(spaceId).roots));

describe('buildTree', () => {
  it('sorts siblings by position even though the fixture is unordered', () => {
    const { roots } = treeFor(101);
    const overview = roots[0];

    expect(roots).toHaveLength(1);
    expect(overview.item.id).toBe(1001);
    expect(ids(overview.children.map((child) => child.item))).toEqual([
      1002, 1003, 1006, 1009,
    ]);
  });

  it('excludes hidden items from the tree', () => {
    const { byId } = treeFor(101);
    expect(byId.has(1010)).toBe(false);
  });

  it('includes hidden items when a host asks for them', () => {
    const { byId } = buildTree(courseworkItems, {
      spaceId: 101,
      includeStatuses: ['posted', 'hidden'],
    });
    expect(byId.has(1010)).toBe(true);
  });

  it('keeps courses separate', () => {
    expect(ids([...treeFor(102).byId.values()]).sort()).toEqual([
      2001, 2002, 2003, 2004, 2005,
    ]);
  });
});

describe('nest', () => {
  it('produces the production nested structure for a sectioned course', () => {
    expect(nestedIds(nest(treeFor(101).roots))).toEqual([
      [1001, [[1002], [1003, [[1004], [1005]]], [1006, [[1007], [1008]]], [1009]]],
    ]);
  });

  it('produces a flat nested structure for a course without sections', () => {
    expect(nestedIds(nest(treeFor(102).roots))).toEqual([
      [2001, [[2002], [2003], [2004], [2005]]],
    ]);
  });
});

describe('flatten', () => {
  it('gives depth-first order and drops the hidden lesson', () => {
    expect(ids(flatFor(101))).toEqual([
      1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009,
    ]);
  });
});

describe('videoLessons', () => {
  it('keeps only playable lessons, skipping overview, sections and the quiz', () => {
    expect(ids(videoLessons(flatFor(101)))).toEqual([1002, 1004, 1005, 1007, 1009]);
  });

  it('never includes the hidden lesson', () => {
    expect(ids(videoLessons(flatFor(101)))).not.toContain(1010);
  });
});

describe('nextVideoLesson', () => {
  it('steps into a section', () => {
    expect(nextVideoLesson(flatFor(101), 1002)?.id).toBe(1004);
  });

  it('steps over a quiz and across a section boundary', () => {
    expect(nextVideoLesson(flatFor(101), 1007)?.id).toBe(1009);
  });

  it('returns null at the end of the course rather than crossing into another', () => {
    expect(nextVideoLesson(flatFor(101), 1009)).toBeNull();
  });

  it('walks a flat course in order', () => {
    const flat = flatFor(102);
    expect(nextVideoLesson(flat, 2002)?.id).toBe(2003);
    // The chain makes no distinction for the YouTube-hosted lesson: it is simply
    // the next playable item. Hosting is the player's problem, not the domain's.
    expect(nextVideoLesson(flat, 2004)?.id).toBe(2005);
    expect(nextVideoLesson(flat, 2005)).toBeNull();
  });
});

describe('prevVideoLesson', () => {
  it('steps backwards over the quiz and section boundary', () => {
    expect(prevVideoLesson(flatFor(101), 1009)?.id).toBe(1007);
  });

  it('returns null at the start of the course', () => {
    expect(prevVideoLesson(flatFor(101), 1002)).toBeNull();
  });
});

describe('itemsToUnlockAfter', () => {
  it('releases the quiz as well as the lesson past it', () => {
    // The case that was broken: the quiz is in nothing's playback chain, so
    // unlocking only the next playable lesson left it locked for the whole course.
    expect(ids(itemsToUnlockAfter(flatFor(101), 1007))).toEqual([1008, 1009]);
  });

  it('releases the section heading it has to cross', () => {
    expect(ids(itemsToUnlockAfter(flatFor(101), 1005))).toEqual([1006, 1007]);
  });

  it('stops at the next playable lesson rather than opening the rest', () => {
    expect(ids(itemsToUnlockAfter(flatFor(101), 1002))).toEqual([1003, 1004]);
  });

  it('releases nothing at the end of the course', () => {
    expect(itemsToUnlockAfter(flatFor(101), 1009)).toEqual([]);
  });

  it('releases exactly one lesson at a time in a course without sections', () => {
    expect(ids(itemsToUnlockAfter(flatFor(102), 2002))).toEqual([2003]);
  });

  it('returns nothing for an item outside the sequence', () => {
    expect(itemsToUnlockAfter(flatFor(101), 1010)).toEqual([]);
  });

  it('leaves nothing locked once every video lesson is completed', () => {
    const flat = flatFor(101);
    const unlocked = new Set([1001, 1002, 1003, 1004, 1005]); // the seeded state
    videoLessons(flat).forEach((lesson) =>
      itemsToUnlockAfter(flat, lesson.id).forEach((item) => unlocked.add(item.id)),
    );
    expect(ids(flat).filter((id) => !unlocked.has(id))).toEqual([]);
  });
});
