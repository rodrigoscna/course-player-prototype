import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

export interface PlayerInstance {
  player: Player;
  /** The video.js wrapper element — this is what gets moved between slots. */
  el: HTMLElement;
  /** Offscreen parent that holds the element whenever no page owns it. */
  holder: HTMLElement;
}

let instance: PlayerInstance | null = null;

/**
 * How many times a player has actually been constructed. The continuity claim
 * is that this stays at 1 for the whole session, so it is worth exposing.
 */
export function getCreateCount(): number {
  return createCount;
}
let createCount = 0;

/**
 * The one player, created on first use and never disposed.
 *
 * Deliberately not created inside a React effect: an effect would be
 * create/dispose/create under StrictMode's double invoke, and every remount
 * would risk another instance. A module singleton with an early return is
 * indifferent to how many times React calls in.
 */
export function getPlayer(): PlayerInstance {
  if (instance) return instance;

  const holder = document.createElement('div');
  holder.className = 'player-holder';
  holder.setAttribute('aria-hidden', 'true');
  // Attached to the document, just offscreen. A detached holder would take the
  // media element out of the document between pages, and the spec pauses a
  // media element whose task ends outside a document.
  document.body.appendChild(holder);

  const video = document.createElement('video');
  video.className = 'video-js vjs-big-play-centered';
  video.playsInline = true;
  // The element must be in the document before videojs() measures it.
  holder.appendChild(video);

  const player = videojs(video, {
    controls: true,
    fluid: true,
    preload: 'auto',
    autoplay: false,
  });

  createCount += 1;
  instance = { player, el: player.el() as HTMLElement, holder };
  return instance;
}

export function peekPlayer(): PlayerInstance | null {
  return instance;
}

// Without this, every hot update leaves the previous player alive and you end
// up with several overlapping audio tracks.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    instance?.player.dispose();
    instance?.holder.remove();
    instance = null;
  });
}
