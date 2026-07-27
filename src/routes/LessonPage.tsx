import { Link, useParams } from 'react-router-dom';
import { AutoplayBlockedOverlay } from '../components/AutoplayBlockedOverlay';
import { LessonPoster } from '../components/LessonPoster';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { UpNextCard } from '../components/UpNextCard';
import { isVideoLesson } from '../domain/sequence';
import { lessonBySlug, lessonPath } from '../domain/selectors';
import { usePlayerSnapshot } from '../player/PlayerHost';
import { PlayerSlot } from '../player/PlayerSlot';
import { usePlayerLesson } from '../player/usePlayerLesson';
import {
  courseDataBySlug,
  prevPlayableBefore,
  videoForLesson,
} from '../store/courseData';

export function LessonPage() {
  const { courseSlug, lessonSlug } = useParams();
  const data = courseDataBySlug(courseSlug);
  const lesson = data ? lessonBySlug(data.flat, lessonSlug) : null;
  const video = lesson ? videoForLesson(lesson) : null;
  const playable = lesson ? isVideoLesson(lesson) : false;
  const snapshot = usePlayerSnapshot();

  // Registers this page as the current route. Never starts playback.
  usePlayerLesson(playable ? lesson : null, video);

  if (!data || !lesson) {
    return (
      <div className="page">
        <h1>Lesson not found</h1>
        <Link to={`/courses/${courseSlug ?? ''}`}>Back to this course</Link>
      </div>
    );
  }

  const section = lesson.parent_id
    ? data.flat.find((item) => item.id === lesson.parent_id)
    : null;
  const showsSection = section?.prompt_type === 'course_section';
  const previous = playable ? prevPlayableBefore(lesson) : null;

  // The player belongs to whichever lesson is loaded, not to whichever page is
  // open — so this page shows it only when those happen to be the same lesson.
  const ownsPlayer = snapshot.playingLessonId === lesson.id;
  const elsewhere =
    snapshot.playingLessonId !== null && snapshot.playingLessonId !== lesson.id
      ? data.flat.find((item) => item.id === snapshot.playingLessonId) ?? null
      : null;

  return (
    <article className="page lesson">
      {elsewhere && <NowPlayingBar playingLesson={elsewhere} />}

      {showsSection && <p className="eyebrow">{section?.title}</p>}
      <h1>{lesson.title}</h1>

      {!playable || !video ? (
        <div className="placeholder-frame">
          {lesson.prompt_type === 'course_quiz'
            ? 'A quiz sits in the table of contents but is not part of the playback chain.'
            : 'This item has no video.'}
        </div>
      ) : ownsPlayer ? (
        <div className="player-frame">
          <PlayerSlot dock="inline" />
          {snapshot.autoplayBlocked && <AutoplayBlockedOverlay />}
          <span className="lesson-badge" data-lesson-id={lesson.id}>
            lesson {lesson.id}
          </span>
        </div>
      ) : (
        <LessonPoster lesson={lesson} video={video} />
      )}

      <p className="lesson-description">{lesson.description}</p>

      <nav className="lesson-nav">
        {previous ? (
          <Link className="ghost-button" to={lessonPath(data.course, previous)}>
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {playable && <UpNextCard lesson={lesson} course={data.course} />}
    </article>
  );
}
