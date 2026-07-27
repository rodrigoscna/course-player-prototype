import { Link } from 'react-router-dom';
import { lessonPath } from '../domain/selectors';
import { controller } from '../player/playerController';
import { usePlayerSnapshot } from '../player/PlayerHost';
import { nextPlayableAfter, videoForLesson } from '../store/courseData';
import type { Course, CourseworkItem } from '../types/coursework';

/**
 * What comes after this lesson. Deliberately has no countdown: a countdown
 * reintroduces exactly the pause this prototype exists to remove.
 */
export function UpNextCard({
  lesson,
  course,
}: {
  lesson: CourseworkItem;
  course: Course;
}) {
  const snapshot = usePlayerSnapshot();
  const next = nextPlayableAfter(lesson);

  if (!next) {
    return (
      <aside className="up-next complete">
        <strong>Course complete</strong>
        <p>That was the last video lesson in {course.title}.</p>
      </aside>
    );
  }

  const nextVideo = videoForLesson(next);
  const waiting = snapshot.pendingNext;

  return (
    <aside className={`up-next${waiting ? ' waiting' : ''}`}>
      <span className="up-next-label">{waiting ? 'Ready to continue' : 'Up next'}</span>
      <Link className="up-next-title" to={lessonPath(course, next)}>
        {next.title}
      </Link>
      {nextVideo && (
        <span className="meta">
          {nextVideo.demo_end_at_seconds ?? nextVideo.duration_seconds}s
        </span>
      )}

      {waiting ? (
        <button type="button" className="primary-button" onClick={() => controller.playNextNow()}>
          Continue
        </button>
      ) : (
        <button type="button" className="ghost-button" onClick={() => controller.playNextNow()}>
          Play next now
        </button>
      )}
    </aside>
  );
}
