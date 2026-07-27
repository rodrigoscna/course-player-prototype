import { useParams } from 'react-router-dom';
import { usePlayerSnapshot, useProgressVersion } from '../player/PlayerHost';
import { progressStore } from '../store/progressStore';
import type { CourseData } from '../store/courseData';
import type { CourseworkItem, NestedCoursework } from '../types/coursework';
import { TocRow } from './TocRow';

/**
 * Renders the nested coursework structure directly — the nesting produced by
 * the domain layer is the shape this UI needs, so no flattening happens here.
 */
export function TableOfContents({ data }: { data: CourseData }) {
  const { lessonSlug } = useParams();
  // Progress mutates outside React, so subscribe to it explicitly.
  useProgressVersion();
  const snapshot = usePlayerSnapshot();
  const progress = progressStore.forSpace(data.course.space_id);

  const renderEntries = (nested: NestedCoursework, depth: number) =>
    nested.map((entry, index) => {
      // A branch is `[item, [children]]`; a leaf is `[item]`.
      if (!Array.isArray(entry)) return null;
      const [item, children] = entry as [CourseworkItem, NestedCoursework?];

      return (
        <li key={item.id ?? index} className={`toc-entry depth-${depth}`}>
          <TocRow
            item={item}
            course={data.course}
            progress={progress}
            isCurrent={item.slug === lessonSlug}
            isPlaying={snapshot.playingLessonId === item.id && snapshot.playing}
          />
          {children && children.length > 0 && (
            <ul className="toc-children">{renderEntries(children, depth + 1)}</ul>
          )}
        </li>
      );
    });

  return (
    <nav aria-label="Course contents">
      <ul className="toc">{renderEntries(data.nested, 0)}</ul>
      <button
        type="button"
        className="ghost-button reset-progress"
        onClick={() => progressStore.reset(data.course.space_id)}
      >
        Reset progress
      </button>
    </nav>
  );
}
