import { Link } from 'react-router-dom';
import { lessonPath } from '../domain/selectors';
import { courseForItem, itemById } from '../store/courseData';
import { usePlayerSnapshot } from './PlayerHost';
import { controller } from './playerController';
import { PlayerSlot } from './PlayerSlot';

/**
 * The custom floating player, laid out to the Native Media Player designs
 * (Figma node 375-3589 small, 375-3590 large).
 *
 * This is the half of the comparison that native picture-in-picture cannot do:
 * every control below is ours, in a container we own, holding the same single
 * video.js instance every other slot holds. video.js runs headless in here.
 *
 * Both states are one grid with the same three children — media, meta, controls —
 * reordered by CSS. The media element deliberately never changes parent between
 * states: moving it would take the video out of its slot mid-playback for no
 * reason a viewer would see.
 *
 * Note what is NOT here: any second player instance. The floating player and the
 * inline player are the same element in different parents, which is why there is
 * no two-instance synchronisation problem to solve.
 */

const REWIND_SECONDS = 30;

export function FloatingPlayer() {
  const snapshot = usePlayerSnapshot();
  const lesson = itemById(snapshot.playingLessonId);
  const course = lesson ? courseForItem(lesson) : null;

  if (!snapshot.floatingVisible || !lesson || !course) return null;

  const tall = snapshot.floatingVariant === 'tall';

  return (
    <aside
      className={`floating-player ${tall ? 'tall' : 'short'}`}
      aria-label={`Floating player: ${lesson.title}`}
    >
      {/*
       * Only the tall card holds the player element. The short bar is chrome, so
       * it shows a cover instead — which is what lets it sit on the lesson's own
       * page while the one video element stays inline above it, and what lets
       * audio keep playing from the offscreen holder.
       */}
      <div className="fp-media">
        {tall ? (
          <PlayerSlot dock="floating" />
        ) : (
          <span className="fp-cover">
            <span aria-hidden="true">♪</span>
            <span className="visually-hidden">Now playing</span>
          </span>
        )}
      </div>

      <div className="fp-meta">
        <Link className="fp-title" to={lessonPath(course, lesson)}>
          {lesson.title}
        </Link>
        <span className="fp-space">{course.title}</span>
      </div>

      <div className="fp-controls">
        <button
          type="button"
          className="fp-button"
          onClick={() => controller.togglePlay()}
          aria-label={snapshot.playing ? 'Pause' : 'Play'}
        >
          {snapshot.playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          className="fp-button"
          onClick={() => controller.rewind(REWIND_SECONDS)}
          aria-label={`Rewind ${REWIND_SECONDS} seconds`}
        >
          <RewindIcon seconds={REWIND_SECONDS} />
        </button>

        <button
          type="button"
          className="fp-button"
          onClick={() => controller.dismissFloating()}
          aria-label="Close floating player"
        >
          <CloseIcon />
        </button>
      </div>

    </aside>
  );
}

/* Icons are inline so the floating player carries no request of its own. */

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6.5 3.7v12.6L17 10z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="4.5" y="3.5" width="4" height="13" rx="1.25" fill="currentColor" />
      <rect x="11.5" y="3.5" width="4" height="13" rx="1.25" fill="currentColor" />
    </svg>
  );
}

/** Circular arrow around the interval, matching the design's 30-second glyph. */
function RewindIcon({ seconds }: { seconds: number }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 4.6A5.9 5.9 0 1 1 4.1 10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M10 1.9v5.4L6.6 4.6z" fill="currentColor" />
      <text
        x="10.4"
        y="13.2"
        textAnchor="middle"
        fill="currentColor"
        fontSize="7"
        fontWeight="600"
      >
        {seconds}
      </text>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M5 5l10 10M15 5L5 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
