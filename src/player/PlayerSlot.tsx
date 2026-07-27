import { useLayoutEffect, useRef } from 'react';
import { controller } from './playerController';
import { getPlayer } from './playerSingleton';

/**
 * The place on a page where the one player appears.
 *
 * React only ever renders the empty div; the player element itself is moved in
 * and out imperatively, so React never owns or re-creates it.
 */
export function PlayerSlot() {
  const ref = useRef<HTMLDivElement>(null);

  // Must be a layout effect. React flushes passive cleanups AFTER removing the
  // deleted subtree's DOM nodes, so with useEffect the cleanup below would run
  // on an element that has already been torn out of the document — and the
  // video pauses on every navigation.
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;

    const { el, holder } = getPlayer();
    // appendChild of an already-parented node moves it in one synchronous
    // operation, so the element is never briefly detached.
    slot.appendChild(el);
    controller.setOwner(slot);

    return () => {
      // A newer slot may already have claimed the player during this commit.
      if (controller.owner !== slot) return;
      holder.appendChild(el);
      controller.setOwner(holder);
      // Never dispose here — the player outlives every page.
    };
  }, []);

  return <div className="player-slot" ref={ref} />;
}
