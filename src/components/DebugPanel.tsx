import { useEffect, useState } from 'react';
import type { Probe } from '../dev/playerProbe';
import { controller } from '../player/playerController';
import { usePlayerSnapshot } from '../player/PlayerHost';

const probe = () => (window as unknown as { __probe?: Probe }).__probe;

/**
 * Makes the continuity claims visible while demoing: one player instance, never
 * detached, and the measured gap at each lesson boundary.
 */
export function DebugPanel() {
  const snapshot = usePlayerSnapshot();
  const [, setTick] = useState(0);

  // The probe mutates outside React, so poll it while the panel is open.
  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  const current = probe();
  const boundaries = current?.boundaries ?? [];
  const tape = current?.lastBoundaryTape() ?? [];

  return (
    <section className="debug-panel">
      <div className="debug-grid">
        <span>
          players created: <strong>{current?.createCount() ?? '—'}</strong>
        </span>
        <span>
          .video-js in DOM: <strong>{current?.playerCount() ?? '—'}</strong>
        </span>
        <span>
          detaches: <strong>{current?.detaches ?? '—'}</strong>
        </span>
        <span>
          playing lesson: <strong>{snapshot.playingLessonId ?? '—'}</strong>
        </span>
        <span>
          dock: <strong>{snapshot.dock}</strong>
          {snapshot.pipRefused && ' (pip refused)'}
        </span>
        <span>
          float mode: <strong>{snapshot.floatMode}</strong>
          {snapshot.floatingVisible && ` / ${snapshot.floatingVariant} bar`}
        </span>
        {/* The headless question, answered on screen rather than in prose. */}
        <span>
          video.js UI: <strong>{snapshot.headless ? 'off (headless)' : 'on'}</strong>
        </span>
        <span>
          boundary gaps: <strong>{boundaries.length ? `${boundaries.join(', ')} ms` : '—'}</strong>
        </span>
      </div>

      <div className="debug-actions">
        <button type="button" className="ghost-button" onClick={() => controller.jumpToNearEnd()}>
          Jump to last 3s
        </button>
        <button type="button" className="ghost-button" onClick={() => current?.reset()}>
          Reset probe
        </button>
      </div>

      {tape.length > 0 && (
        <p className="debug-tape">
          last boundary: {tape.map((event) => event.type).join(' → ')}
        </p>
      )}
    </section>
  );
}
