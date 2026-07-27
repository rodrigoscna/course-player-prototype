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

/** The two floating states the design calls for. */
export type FloatingSize = 'small' | 'large';

export type AdvanceMode = 'keep-route' | 'follow' | 'stop';

/** What should happen when a clip reaches its end. */
export type AdvanceAction = 'advance-and-navigate' | 'advance-only' | 'stop';

export function decideDock({
  routeLessonId,
  playingLessonId,
  isPlaying,
  hasPlayed,
  floatMode,
  floatingDismissed,
}: {
  routeLessonId: number | null;
  playingLessonId: number | null;
  isPlaying: boolean;
  /**
   * Whether playback has begun at any point this session. Deliberately not
   * per-source: an advance briefly has no started source, and gating the
   * container on that would tear it down and rebuild it at every lesson
   * boundary — the one moment continuity is being measured.
   */
  hasPlayed: boolean;
  floatMode: FloatMode;
  /** The user closed the floating player, which outranks every rule below. */
  floatingDismissed: boolean;
}): DockTarget {
  if (playingLessonId === null) return 'parked';
  // Reading the lesson that is loaded: show it in the page, wherever it is up to.
  if (routeLessonId === playingLessonId) return 'inline';
  if (floatingDismissed) return 'parked';

  // Reading something else: keep the video watchable rather than yanking it off
  // screen. Where it goes is the one real difference between the two modes.
  if (floatMode === 'custom') {
    // A container we own carries its own controls, so it stays useful while
    // paused — you can resume from it. Native picture-in-picture cannot: the
    // browser only grants that window around active playback.
    return hasPlayed ? 'floating' : 'parked';
  }
  if (isPlaying) return 'pip';
  // Nothing is playing, so there is nothing to keep watching.
  return 'parked';
}

/**
 * Which floating state to show, from the design's two.
 *
 * Small is for when there is nothing to watch — audio-first content, or a video
 * the user has deliberately shrunk. Large is for a video belonging to a lesson
 * they are not looking at, which is the case that needs a picture at all.
 *
 * The design also lists the current lesson's own header media as a small-state
 * case. That one cannot arise here: while you are on the playing lesson the dock
 * is `inline`, so reaching it would need scroll tracking that this prototype
 * does not do. The collapse button covers the same state on demand.
 */
export function decideFloatingSize({
  isAudioOnly,
  collapsed,
}: {
  isAudioOnly: boolean;
  collapsed: boolean;
}): FloatingSize {
  if (isAudioOnly) return 'small';
  return collapsed ? 'small' : 'large';
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
