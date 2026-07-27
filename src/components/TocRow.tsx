import { Link } from 'react-router-dom';
import { isCompleted, isLocked, isViewed, lessonPath } from '../domain/selectors';
import type { Course, CourseworkItem, ProgressPayload } from '../types/coursework';

interface TocRowProps {
  item: CourseworkItem;
  course: Course;
  progress: ProgressPayload;
  /** The page currently open. */
  isCurrent: boolean;
  /** The lesson the player has loaded, which may be a different one. */
  isPlaying: boolean;
}

/**
 * Indicator precedence: locked wins over everything, then what is playing —
 * since playback is independent of navigation, that is the more useful signal —
 * then completion, then the page you happen to be reading.
 */
function indicatorFor(
  item: CourseworkItem,
  progress: ProgressPayload,
  isCurrent: boolean,
  isPlaying: boolean,
): { glyph: string; label: string } {
  if (isLocked(item, progress)) return { glyph: '🔒', label: 'Locked' };
  if (isPlaying) return { glyph: '♪', label: 'Playing' };
  if (isCompleted(item, progress)) return { glyph: '✓', label: 'Completed' };
  if (isCurrent) return { glyph: '▶', label: 'Open' };
  if (isViewed(item, progress)) return { glyph: '◐', label: 'Started' };
  if (item.prompt_type === 'course_quiz') return { glyph: '?', label: 'Quiz' };
  return { glyph: '', label: '' };
}

export function TocRow({ item, course, progress, isCurrent, isPlaying }: TocRowProps) {
  if (item.prompt_type === 'course_section') {
    return (
      <div className="toc-section">
        <span className="toc-section-title">{item.title}</span>
      </div>
    );
  }

  const locked = isLocked(item, progress);
  const { glyph, label } = indicatorFor(item, progress, isCurrent, isPlaying);

  const inner = (
    <>
      <span className="toc-indicator" aria-hidden="true">
        {glyph}
      </span>
      <span className="toc-row-title">{item.title}</span>
      {label && <span className="visually-hidden">{label}</span>}
    </>
  );

  if (locked) {
    return (
      <span className="toc-row locked" aria-disabled="true">
        {inner}
      </span>
    );
  }

  return (
    <Link
      to={lessonPath(course, item)}
      className={`toc-row${isCurrent ? ' current' : ''}`}
      aria-current={isCurrent ? 'page' : undefined}
    >
      {inner}
    </Link>
  );
}
