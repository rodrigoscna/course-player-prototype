/**
 * Where the player belongs, and what an ending clip should do.
 *
 * Pure decisions kept away from the player and the DOM so they can be reasoned
 * about — and tested — on their own. Navigation and playback are independent
 * here: the lesson you are reading and the lesson that is playing are two
 * different things, and these functions are where that distinction is resolved.
 */

/** Where the player element should live right now. */
export type DockTarget =
  /** In the current page's slot. */
  | 'inline'
  /** In a floating container this app owns and renders, still inside the page. */
  | 'floating'
  /** In the browser's picture-in-picture window, element parked offscreen. */
  | 'pip'
  /** Offscreen, no floating window. */
  | 'parked';

/**
 * Which of the two approaches to keeping a video watchable is in play.
 *
 * Both are wired up on purpose. They are not equivalent, and the differences are
 * the point: native picture-in-picture is a browser window we do not control and
 * cannot add controls to, while a custom container is ours to lay out but has to
 * reimplement everything the browser gave us for free.
 */
export type FloatMode =
  /** Our own in-page container, video.js driven headlessly inside it. */
  | 'custom'
  /** `requestPictureInPicture()`, with the browser's own window and chrome. */
  | 'native-pip';

/**
 * The two floating players the design calls for.
 *
 * Not a size the user picks — the content decides. `tall` is the only one that
 * carries a picture, and so the only one that holds the player element; `short`
 * is chrome alone, which is what lets it sit alongside a lesson page that is
 * already showing the video inline.
 */
export type FloatingVariant = 'short' | 'tall';

export type AdvanceMode = 'keep-route' | 'follow' | 'stop';

/** What should happen when a clip reaches its end. */
export type AdvanceAction = 'advance-and-navigate' | 'advance-only' | 'stop';

export function decideDock({
  routeLessonId,
  playingLessonId,
  isPlaying,
  awaitingPlayback,
  isAudioOnly,
  floatMode,
  floatingDismissed,
}: {
  routeLessonId: number | null;
  playingLessonId: number | null;
  isPlaying: boolean;
  /**
   * A source has been asked to play and has not started yet — the gap an advance
   * opens at every lesson boundary, where the old clip has ended and the new one
   * is still loading.
   *
   * Counted as playing on purpose. Without it the container would be torn down
   * and rebuilt at each boundary, which is both a visible flicker and the one
   * moment this prototype exists to measure.
   */
  awaitingPlayback: boolean;
  /** Audio-first media, which the short bar covers rather than shows. */
  isAudioOnly: boolean;
  floatMode: FloatMode;
  /** The user closed the floating player, which outranks every rule below. */
  floatingDismissed: boolean;
}): DockTarget {
  if (playingLessonId === null) return 'parked';
  // Reading the lesson that is loaded: show it in the page, wherever it is up to.
  if (routeLessonId === playingLessonId) return 'inline';
  if (floatingDismissed) return 'parked';

  // Nothing playing means nothing to float: a card sitting there stopped is not
  // showing anything, it is just in the way. Both modes agree on that, and differ
  // only in where playback goes when there is some.
  if (!isPlaying && !awaitingPlayback) return 'parked';

  if (floatMode !== 'custom') return 'pip';

  // Only the tall card carries a picture, so only it needs the element. Audio
  // keeps playing from the offscreen holder while the short bar shows its cover —
  // moving the element into a box that covers it would buy nothing.
  return isAudioOnly ? 'parked' : 'floating';
}

/**
 * Whether the floating player's chrome belongs on screen.
 *
 * Deliberately separate from `decideDock`. Where the element lives and whether the
 * controls are visible stopped being the same question once the short bar had to
 * appear on a page that is already showing the video inline: there the element is
 * docked `inline` and the bar is on screen at the same time.
 */
export function decideFloatingVisible({
  playingLessonId,
  isPlaying,
  awaitingPlayback,
  floatMode,
  floatingDismissed,
}: {
  playingLessonId: number | null;
  isPlaying: boolean;
  awaitingPlayback: boolean;
  floatMode: FloatMode;
  floatingDismissed: boolean;
}): boolean {
  if (playingLessonId === null) return false;
  // Native mode has the browser's own window; ours would be a second player.
  if (floatMode !== 'custom') return false;
  if (floatingDismissed) return false;
  return isPlaying || awaitingPlayback;
}

/**
 * Which of the design's two floating players to show.
 *
 * Tall is for the one case that needs a picture: video belonging to a lesson the
 * reader is not looking at. Everything else is short — audio has no picture, and
 * on the lesson's own page the picture is already there, inline.
 */
export function decideFloatingVariant({
  onMediaPage,
  isAudioOnly,
}: {
  /** Whether the open page is the one whose media is playing. */
  onMediaPage: boolean;
  isAudioOnly: boolean;
}): FloatingVariant {
  return onMediaPage || isAudioOnly ? 'short' : 'tall';
}

export function decideAdvanceTarget({
  mode,
  isFollowingAlong,
}: {
  mode: AdvanceMode;
  /** Whether the page you are on is the lesson that just ended. */
  isFollowingAlong: boolean;
}): AdvanceAction {
  // Watching the lesson that ended means moving the route with it is expected,
  // not a hijack — so every mode navigates in that case.
  if (isFollowingAlong) return 'advance-and-navigate';

  switch (mode) {
    case 'follow':
      return 'advance-and-navigate';
    case 'stop':
      return 'stop';
    case 'keep-route':
    default:
      return 'advance-only';
  }
}
