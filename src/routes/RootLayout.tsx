import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { DebugPanel } from '../components/DebugPanel';
import type { AdvanceMode, FloatMode } from '../player/dockPolicy';
import { FloatingPlayer } from '../player/FloatingPlayer';
import { controller } from '../player/playerController';
import { usePlayerSnapshot } from '../player/PlayerHost';

export function RootLayout() {
  const snapshot = usePlayerSnapshot();
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">
          Course Player Prototype
        </Link>

        <div className="app-header-actions">
          {/* The A/B the two approaches need to be compared side by side. */}
          <label className="switch">
            <span>Floating player</span>
            <select
              value={snapshot.floatMode}
              onChange={(event) =>
                controller.setFloatMode(event.target.value as FloatMode)
              }
            >
              <option value="custom">custom container</option>
              <option value="native-pip">browser picture-in-picture</option>
            </select>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={snapshot.autoplayNext}
              onChange={(event) => controller.setAutoplayNext(event.target.checked)}
            />
            <span>Autoplay next lesson</span>
          </label>

          {/* What an ending clip does when you are reading a different lesson. */}
          <label className="switch">
            <span>When a clip ends elsewhere</span>
            <select
              value={snapshot.advanceMode}
              onChange={(event) =>
                controller.setAdvanceMode(event.target.value as AdvanceMode)
              }
            >
              <option value="keep-route">advance, keep my page</option>
              <option value="follow">advance and follow</option>
              <option value="stop">stop at the end</option>
            </select>
          </label>

          <button type="button" className="ghost-button" onClick={() => setDebugOpen((open) => !open)}>
            {debugOpen ? 'Hide' : 'Show'} debug
          </button>
        </div>
      </header>

      {debugOpen && <DebugPanel />}

      <main className="app-main">
        <Outlet />
      </main>

      {/*
       * Outside <main> and a sibling of every page, so no route change can
       * unmount it while it holds the player.
       */}
      <FloatingPlayer />
    </div>
  );
}
