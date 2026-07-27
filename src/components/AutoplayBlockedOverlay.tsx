import { controller } from '../player/playerController';

/** Shown when the browser refused to start playback even muted. */
export function AutoplayBlockedOverlay() {
  return (
    <div className="autoplay-blocked">
      <p>Your browser blocked autoplay.</p>
      <button type="button" className="primary-button" onClick={() => controller.unmute()}>
        Press play to continue
      </button>
    </div>
  );
}
