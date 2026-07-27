import type Player from 'video.js/dist/types/player';
import { getCreateCount, peekPlayer } from '../player/playerSingleton';

/**
 * Instrumentation for the continuity claims. Exposed as `window.__probe` so the
 * assertions can be run from the console rather than judged by eye.
 *
 * The sharpest signal here is `events`: a `pause` between one source's `ended`
 * and the next source's `playing` is the exact signature of a broken reparent,
 * which is much easier to miss visually than to detect in the tape.
 */

export interface ProbeEvent {
  t: number;
  type: string;
  src: string;
  currentTime: number;
  path: string;
}

export interface Probe {
  createCount: () => number;
  events: ProbeEvent[];
  detaches: number;
  /** Milliseconds from one clip's `ended` to the next clip's `playing`. */
  boundaries: number[];
  /** How many `.video-js` wrappers exist — should always be exactly 1. */
  playerCount: () => number;
  /** The event slice around the most recent source change. */
  lastBoundaryTape: () => ProbeEvent[];
  reset: () => void;
}

const TRACKED_EVENTS = [
  'ended',
  'emptied',
  'loadstart',
  'loadedmetadata',
  'canplay',
  'playing',
  'play',
  'pause',
  'waiting',
  'seeking',
  'error',
] as const;

let installed = false;

export function installPlayerProbe(player: Player): void {
  if (installed) return;
  installed = true;

  const events: ProbeEvent[] = [];
  const boundaries: number[] = [];
  let lastEndedAt: number | null = null;

  const probe: Probe = {
    createCount: getCreateCount,
    events,
    detaches: 0,
    boundaries,
    playerCount: () => document.querySelectorAll('.video-js').length,
    lastBoundaryTape: () => {
      const lastEnded = events.map((event) => event.type).lastIndexOf('ended');
      return lastEnded === -1 ? [] : events.slice(lastEnded);
    },
    reset: () => {
      events.length = 0;
      boundaries.length = 0;
      probe.detaches = 0;
      lastEndedAt = null;
    },
  };

  TRACKED_EVENTS.forEach((type) => {
    player.on(type, () => {
      events.push({
        t: performance.now(),
        type,
        src: player.currentSrc() ?? '',
        currentTime: player.currentTime() ?? 0,
        path: window.location.pathname,
      });

      if (type === 'ended') lastEndedAt = performance.now();
      if (type === 'playing' && lastEndedAt !== null) {
        boundaries.push(Math.round(performance.now() - lastEndedAt));
        lastEndedAt = null;
      }
    });
  });

  // Any moment the element leaves the document is a continuity bug, so count it
  // rather than relying on noticing a stutter.
  const observer = new MutationObserver(() => {
    const el = peekPlayer()?.el;
    if (el && !document.contains(el)) probe.detaches += 1;
  });
  observer.observe(document.body, { childList: true, subtree: true });

  (window as unknown as { __probe: Probe }).__probe = probe;
  (window as unknown as { __player: Player }).__player = player;
}
