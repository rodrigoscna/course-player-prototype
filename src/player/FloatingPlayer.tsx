import { Link } from 'react-router-dom';
import { lessonPath } from '../domain/selectors';
import {
  courseForItem,
  itemById,
  nextPlayableAfter,
  prevPlayableBefore,
  videoForLesson,
} from '../store/courseData';
import { usePlayerSnapshot } from './PlayerHost';
import { controller } from './playerController';
import { PlayerSlot } from './PlayerSlot';

/**
 * The custom floating player: a container this app owns, holding the same single
 * video.js instance every other slot holds.
 *
 * This is the half of the comparison that native picture-in-picture cannot do.
 * Everything below the stage — previous, next, the seek bar, the link back to the
 * lesson — is chrome the browser's picture-in-picture window has no room for. The
 * cost is that all of it has to exist: video.js is running headless in here, so
 * nothing is inherited.
 *
 * Note what is NOT here: any second player instance. The floating player and the
 * inline player are the same element in different parents, which is why there is
 * no two-instance synchronisation problem to solve.
 */

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function FloatingPlayer() {
  const snapshot = usePlayerSnapshot();
  const lesson = itemById(snapshot.playingLessonId);
  const course = lesson ? courseForItem(lesson) : null;

  if (snapshot.dock !== 'floating' || !lesson || !course) return null;

  const audioOnly = videoForLesson(lesson)?.audio_only === true;
  const small = snapshot.floatingSize === 'small';
  const { positionSeconds, durationSeconds } = snapshot;
  const fraction = durationSeconds > 0 ? positionSeconds / durationSeconds : 0;

  return (
    <aside
      className={`floating-player ${small ? 'small' : 'large'}`}
      aria-label={`Floating player: ${lesson.title}`}
    >
      {/*
       * The stage always renders the player, in both states. Shrinking it is a
       * CSS concern — unmounting the slot would move the element out and stop
       * playback, and `display: none` invites the browser to stop decoding.
       */}
      <div className="floating-stage">
        <PlayerSlot />
        {audioOnly && (
          <span className="floating-audio-cover">
            <span aria-hidden="true">♪</span>
            <span className="visually-hidden">Audio-only lesson</span>
          </span>
        )}
      </div>

      <div className="floating-body">
        <div className="floating-meta">
          <Link className="floating-title" to={lessonPath(course, lesson)}>
            {lesson.title}
          </Link>
          <span className="floating-course">{course.title}</span>
        </div>

        <div className="floating-transport">
          <button
            type="button"
            className="floating-button"
            onClick={() => controller.playPrevNow()}
            disabled={prevPlayableBefore(lesson) === null}
            aria-label="Previous lesson"
          >
            <span aria-hidden="true">⏮</span>
          </button>

          <button
            type="button"
            className="floating-button primary"
            onClick={() => controller.togglePlay()}
            aria-label={snapshot.playing ? 'Pause' : 'Play'}
          >
            <span aria-hidden="true">{snapshot.playing ? '❚❚' : '▶'}</span>
          </button>

          <button
            type="button"
            className="floating-button"
            onClick={() => controller.playNextNow()}
            disabled={nextPlayableAfter(lesson) === null}
            aria-label="Next lesson"
          >
            <span aria-hidden="true">⏭</span>
          </button>

          <span className="floating-time">
            {clock(positionSeconds)} / {clock(durationSeconds)}
          </span>
        </div>

        {/*
         * A real range input rather than a styled div: it gives keyboard seeking
         * for free, and driving `currentTime` from it is the sharpest available
         * demonstration that video.js is under API control here.
         */}
        <input
          type="range"
          className="floating-seek"
          min={0}
          max={1000}
          value={Math.round(fraction * 1000)}
          onChange={(event) =>
            controller.seekToFraction(Number(event.target.value) / 1000)
          }
          aria-label="Seek"
        />
      </div>

      <div className="floating-actions">
        <button
          type="button"
          className="floating-button"
          onClick={() => controller.toggleCollapsed()}
          // Audio-only content has no large state to grow into.
          disabled={audioOnly}
          aria-label={small ? 'Expand player' : 'Collapse player'}
        >
          <span aria-hidden="true">{small ? '⤢' : '⤡'}</span>
        </button>

        <button
          type="button"
          className="floating-button"
          onClick={() => controller.dismissFloating()}
          aria-label="Close floating player"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </aside>
  );
}
