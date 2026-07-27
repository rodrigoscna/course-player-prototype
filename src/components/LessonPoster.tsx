import { controller } from '../player/playerController';
import type { CourseworkItem, VideoRecord } from '../types/coursework';

/**
 * Stands in for the player on a lesson you are reading but not watching.
 *
 * Playing from here is an explicit choice, which is the point of separating
 * navigation from playback — and being a real click, it is also the gesture the
 * browser needs to let us leave picture-in-picture.
 */
export function LessonPoster({
  lesson,
  video,
}: {
  lesson: CourseworkItem;
  video: VideoRecord;
}) {
  const seconds = video.demo_end_at_seconds ?? video.duration_seconds;

  return (
    <div className="lesson-poster">
      <button
        type="button"
        className="poster-play"
        onClick={() => controller.playLesson(lesson, video)}
      >
        <span className="poster-play-glyph" aria-hidden="true">
          ▶
        </span>
        Play this lesson
      </button>
      <span className="meta">{seconds}s</span>
    </div>
  );
}
