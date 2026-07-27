import { Link } from 'react-router-dom';
import { lessonPath } from '../domain/selectors';
import type { DockTarget } from '../player/dockPolicy';
import { usePlayerSnapshot } from '../player/PlayerHost';
import { controller } from '../player/playerController';
import { courseForItem } from '../store/courseData';
import type { CourseworkItem } from '../types/coursework';

/**
 * Shown while the lesson that is playing is not the lesson you are reading.
 *
 * Doubles as the fallback when the browser refuses picture-in-picture: playback
 * carries on regardless, and this is what keeps it findable — plus an explicit
 * pop-out button, which is a real gesture and so is always allowed.
 */
/**
 * Playing with no window to show it in is the state most worth naming, so it
 * gets its own wording rather than being lumped in with a paused clip.
 */
function label(dock: DockTarget, playing: boolean): string {
  if (dock === 'pip') return 'Playing in picture-in-picture: ';
  // The floating player is on screen and has its own controls, so this bar is
  // only a pointer back to the lesson rather than the thing keeping it findable.
  if (dock === 'floating') return 'Playing in the floating player: ';
  if (playing) return 'Playing off-screen: ';
  return 'Still loaded: ';
}

export function NowPlayingBar({ playingLesson }: { playingLesson: CourseworkItem }) {
  const snapshot = usePlayerSnapshot();
  const course = courseForItem(playingLesson);
  if (!course) return null;

  return (
    <div className={`now-playing${snapshot.pipRefused ? ' refused' : ''}`}>
      <span className="now-playing-glyph" aria-hidden="true">
        {snapshot.playing ? '♪' : '❚❚'}
      </span>

      <span className="now-playing-text">
        {label(snapshot.dock, snapshot.playing)}
        <Link to={lessonPath(course, playingLesson)}>{playingLesson.title}</Link>
      </span>

      {snapshot.dock !== 'pip' && snapshot.dock !== 'floating' && snapshot.playing && (
        <button type="button" className="ghost-button" onClick={() => void controller.popOut()}>
          Pop out
        </button>
      )}
    </div>
  );
}
