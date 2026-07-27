import { useLayoutEffect, useRef } from 'react';
import type { DockTarget } from './dockPolicy';
import { usePlayerSnapshot } from './PlayerHost';
import { controller } from './playerController';
import { getPlayer } from './playerSingleton';

/**
 * The place on a page where the one player appears.
 *
 * React only ever renders the empty div; the player element itself is moved in
 * and out imperatively, so React never owns or re-creates it.
 *
 * `dock` is which state this slot serves. Two slots exist — one inline on the
 * lesson page, one inside the floating player — and only the slot matching the
 * current dock may hold the element. Keying the effect on the active dock is
 * what makes the surviving slot re-claim: otherwise a slot that unmounts parks
 * the element offscreen while the other slot, already mounted and with no reason
 * to re-run, never takes it back — leaving the video playing in a holder nobody
 * can see, behind a visible but empty frame.
 */
export function PlayerSlot({ dock }: { dock: DockTarget }) {
  const ref = useRef<HTMLDivElement>(null);
  const activeDock = usePlayerSnapshot().dock;

  // Must be a layout effect. React flushes passive cleanups AFTER removing the
  // deleted subtree's DOM nodes, so with useEffect the cleanup below would run
  // on an element that has already been torn out of the document — and the
  // video pauses on every navigation.
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot || activeDock !== dock) return;

    const { el, holder } = getPlayer();
    // appendChild of an already-parented node moves it in one synchronous
    // operation, so the element is never briefly detached.
    if (el.parentElement !== slot) slot.appendChild(el);
    controller.setOwner(slot);

    return () => {
      // A newer slot may already have claimed the player during this commit.
      if (controller.owner !== slot) return;
      holder.appendChild(el);
      controller.setOwner(holder);
      // Never dispose here — the player outlives every page.
    };
  }, [activeDock, dock]);

  return <div className="player-slot" ref={ref} />;
}
