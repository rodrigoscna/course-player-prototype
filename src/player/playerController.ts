import type { Course, CourseworkItem, VideoRecord } from '../types/coursework';
import {
  decideAdvanceTarget,
  decideDock,
  decideFloatingSize,
  type AdvanceMode,
  type DockTarget,
  type FloatingSize,
  type FloatMode,
} from './dockPolicy';
import { navigateTo } from './navigation';
import { exitPip, isAnyPipActive, requestPip } from './pictureInPicture';
import { getPlayer } from './playerSingleton';

/** How long a stuck advance is allowed to block further advances. */
const ADVANCE_RELEASE_MS = 3000;

export interface PlayerSnapshot {
  /** The lesson the player has loaded — independent of the page you are on. */
  playingLessonId: number | null;
  currentVideoId: number | null;
  playing: boolean;
  /** Whether playback has begun for the loaded source. */
  started: boolean;
  autoplayNext: boolean;
  advanceMode: AdvanceMode;
  /** An advance was suppressed, so the next lesson waits for an explicit go. */
  pendingNext: boolean;
  courseComplete: boolean;
  /** The browser refused to start playback even muted. */
  autoplayBlocked: boolean;
  muted: boolean;
  /** Where the player element currently is. */
  dock: DockTarget;
  /** True when a picture-in-picture request was refused while browsing away. */
  pipRefused: boolean;
  /** Which floating approach is in effect. */
  floatMode: FloatMode;
  /** Which of the design's two floating states is showing. */
  floatingSize: FloatingSize;
  /** Whether the user has shrunk the floating player by hand. */
  collapsed: boolean;
  /** The floating player was closed, so nothing floats until playback restarts. */
  floatingDismissed: boolean;
  /**
   * True while video.js is rendering no UI of its own and this app is driving it
   * entirely through its API. The headless claim, in one boolean.
   */
  headless: boolean;
  /** Playback has begun at least once this session. */
  hasPlayed: boolean;
  /** Position and effective end, for chrome we draw ourselves. */
  positionSeconds: number;
  durationSeconds: number;
}

interface Wiring {
  nextLessonFor: (lessonId: number) => CourseworkItem | null;
  prevLessonFor: (lessonId: number) => CourseworkItem | null;
  videoFor: (lesson: CourseworkItem) => VideoRecord | null;
  courseFor: (lesson: CourseworkItem) => Course | null;
  lessonPath: (course: Course, lesson: CourseworkItem) => string;
  onLessonCompleted: (lessonId: number) => void;
  onLessonStarted: (lessonId: number) => void;
  resumePositionFor: (lessonId: number, videoId: number) => number;
  savePosition: (lessonId: number, videoId: number, seconds: number) => void;
}

const state: PlayerSnapshot = {
  playingLessonId: null,
  currentVideoId: null,
  playing: false,
  started: false,
  autoplayNext: true,
  advanceMode: 'keep-route',
  pendingNext: false,
  courseComplete: false,
  autoplayBlocked: false,
  muted: false,
  dock: 'parked',
  pipRefused: false,
  // The custom container is the default because it is the approach under
  // evaluation; the selector in the header switches to native for comparison.
  floatMode: 'custom',
  floatingSize: 'large',
  collapsed: false,
  floatingDismissed: false,
  headless: false,
  hasPlayed: false,
  positionSeconds: 0,
  durationSeconds: 0,
};

let snapshot: PlayerSnapshot = { ...state };
const listeners = new Set<() => void>();

let wiring: Wiring | null = null;
let owner: Element | null = null;
let advancing = false;
let advanceReleaseTimer: number | null = null;
let listenersBound = false;
/** The lesson whose page is currently open, which may not be the playing one. */
let routeLessonId: number | null = null;
let playingLesson: CourseworkItem | null = null;

function notify(): void {
  snapshot = { ...state };
  listeners.forEach((listener) => listener());
}

function techEl(): HTMLVideoElement | null {
  const tech = getPlayer().player.tech?.(true) as { el?: () => Element } | undefined;
  return (tech?.el?.() as HTMLVideoElement | undefined) ?? null;
}

export const controller = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): PlayerSnapshot {
    return snapshot;
  },

  configure(next: Wiring): void {
    wiring = next;
    bindPlayerListeners();
  },

  get owner(): Element | null {
    return owner;
  },

  setOwner(next: Element | null): void {
    owner = next;
  },

  setAutoplayNext(enabled: boolean): void {
    state.autoplayNext = enabled;
    if (enabled) state.pendingNext = false;
    notify();
  },

  setAdvanceMode(mode: AdvanceMode): void {
    state.advanceMode = mode;
    notify();
  },

  /** Switch between the custom container and native picture-in-picture. */
  setFloatMode(mode: FloatMode): void {
    if (state.floatMode === mode) return;
    state.floatMode = mode;
    state.floatingDismissed = false;
    state.pipRefused = false;
    void applyDock();
  },

  /** Shrink or grow the floating player between the design's two states. */
  toggleCollapsed(): void {
    state.collapsed = !state.collapsed;
    void applyDock();
  },

  /**
   * Close the floating player.
   *
   * Pauses rather than carrying on invisibly: a floating player is the only
   * thing showing that something is playing, so closing it while audio
   * continued would leave a sound with no way back to it.
   */
  dismissFloating(): void {
    getPlayer().player.pause();
    state.floatingDismissed = true;
    state.collapsed = false;
    void applyDock();
  },

  /** Play/pause from our own chrome, which is the whole headless claim. */
  togglePlay(): void {
    const { player } = getPlayer();
    if (player.paused()) void attemptPlay();
    else player.pause();
  },

  /**
   * Back to the previous lesson, which native picture-in-picture cannot offer —
   * its window has no room for controls we define. Deliberately does not move
   * the route, matching what an ending clip does in keep-route mode.
   */
  playPrevNow(): void {
    const from = state.playingLessonId;
    if (from == null || !wiring) return;
    const prev = wiring.prevLessonFor(from);
    if (!prev) return;
    const video = wiring.videoFor(prev);
    if (!video) return;
    state.pendingNext = false;
    setLesson(prev, video, { autoplay: true });
  },

  /** Seek from a progress bar we draw ourselves. */
  seekToFraction(fraction: number): void {
    const duration = effectiveDuration();
    if (duration <= 0) return;
    const clamped = Math.min(Math.max(fraction, 0), 1);
    getPlayer().player.currentTime(clamped * duration);
  },

  unmute(): void {
    getPlayer().player.muted(false);
    state.muted = false;
    state.autoplayBlocked = false;
    notify();
  },

  /**
   * Records which lesson page is open and moves the player to wherever that
   * leaves it. Called by every lesson page; navigation alone never changes what
   * is playing.
   */
  setRouteLesson(lesson: CourseworkItem | null): void {
    routeLessonId = lesson?.id ?? null;
    void applyDock();
  },

  /**
   * Load a lesson only if the player has nothing going on. This is what makes
   * navigation non-destructive: arriving at a lesson while another one plays
   * leaves the playing one alone.
   */
  claimIfIdle(lesson: CourseworkItem, video: VideoRecord): void {
    const idle = state.playingLessonId === null || (!state.playing && !state.started);
    if (!idle) return;
    setLesson(lesson, video, { autoplay: false });
  },

  /** An explicit request to play this lesson now, taking over the player. */
  playLesson(lesson: CourseworkItem, video: VideoRecord): void {
    // Called from a click, so this is the moment PiP can legally be dismissed.
    void exitPip();
    // Choosing to play something is the clearest possible signal that a closed
    // floating player should be allowed back.
    state.floatingDismissed = false;
    if (state.playingLessonId === lesson.id) {
      void attemptPlay();
      return;
    }
    setLesson(lesson, video, { autoplay: true });
  },

  /** Explicit user request to move on, from the "Continue" affordance. */
  playNextNow(): void {
    state.pendingNext = false;
    advance('manual', { force: true });
  },

  /** Jump near the end so a boundary can be demonstrated without waiting. */
  jumpToNearEnd(): void {
    const { player } = getPlayer();
    const target = effectiveEnd(player.duration());
    if (Number.isFinite(target) && target > 3) player.currentTime(target - 3);
  },

  /** Explicit pop-out, for when the browser refused an automatic request. */
  async popOut(): Promise<boolean> {
    const granted = await requestPip(techEl());
    state.pipRefused = !granted;
    if (granted) state.dock = 'pip';
    notify();
    return granted;
  },
};

function setLesson(
  lesson: CourseworkItem,
  video: VideoRecord,
  { autoplay }: { autoplay: boolean },
): void {
  // Idempotent on lesson id: after an advance swaps the source and navigates,
  // the newly mounted page asks for the same lesson again, and re-setting the
  // source there would restart playback from zero.
  if (state.playingLessonId === lesson.id) return;

  const { player } = getPlayer();
  playingLesson = lesson;
  state.playingLessonId = lesson.id;
  state.currentVideoId = video.id;
  state.started = false;
  state.courseComplete = false;
  state.pendingNext = false;
  state.floatingDismissed = false;
  state.positionSeconds = 0;
  state.durationSeconds = 0;

  player.src({ src: video.url, type: video.type });

  const resume = wiring?.resumePositionFor(lesson.id, video.id) ?? 0;
  player.one('loadedmetadata', () => {
    if (resume > 1) player.currentTime(resume);
  });

  wiring?.onLessonStarted(lesson.id);
  void applyDock();
  notify();

  if (autoplay) void attemptPlay();
}

/**
 * Moves the player to wherever the current route and playback state put it.
 * Only the picture-in-picture transitions happen here; the inline and floating
 * cases are a slot claiming the element itself.
 */
async function applyDock(): Promise<void> {
  const target = decideDock({
    routeLessonId,
    playingLessonId: state.playingLessonId,
    isPlaying: state.playing,
    hasPlayed: state.hasPlayed,
    floatMode: state.floatMode,
    floatingDismissed: state.floatingDismissed,
  });

  const previous = state.dock;
  state.dock = target;
  state.floatingSize = decideFloatingSize({
    isAudioOnly: currentVideo()?.audio_only === true,
    collapsed: state.collapsed,
  });

  // Headless is a per-dock decision, not a global setting: video.js keeps its own
  // controls inline, where they are the best thing available, and gives them up
  // in the floating container, where our chrome replaces them.
  const headless = target === 'floating';
  getPlayer().player.controls(!headless);
  state.headless = headless;

  // The floating path never awaits, so `notify()` below still runs synchronously
  // for it — the slot must be able to claim the element in the same commit that
  // the layout effect asking for this dock is running in.
  if (target === 'pip' && previous !== 'pip') {
    const granted = await requestPip(techEl());
    state.pipRefused = !granted;
    if (!granted) state.dock = 'parked';
  } else if (target !== 'pip' && isAnyPipActive()) {
    // Back on the playing lesson's page (or nothing to float): the inline
    // player takes over again.
    await exitPip();
    state.pipRefused = false;
  }

  notify();
}

/** Where this clip should be treated as finished. */
function effectiveEnd(duration: number | undefined): number {
  const demoEnd = currentVideo()?.demo_end_at_seconds;
  if (demoEnd) return demoEnd;
  return duration ?? Number.POSITIVE_INFINITY;
}

function currentVideo(): VideoRecord | null {
  if (!playingLesson || !wiring) return null;
  return wiring.videoFor(playingLesson);
}

/** The end our own progress bar should measure against, demo window included. */
function effectiveDuration(): number {
  const end = effectiveEnd(getPlayer().player.duration());
  return Number.isFinite(end) ? end : 0;
}

async function attemptPlay(): Promise<void> {
  const { player } = getPlayer();
  try {
    await player.play();
    state.autoplayBlocked = false;
    notify();
  } catch {
    // Autoplay policy refused a sound-on start. Muted playback keeps the
    // continuity visible; surface a badge so the user can unmute.
    try {
      player.muted(true);
      state.muted = true;
      await player.play();
      state.autoplayBlocked = false;
    } catch {
      state.autoplayBlocked = true;
    }
    notify();
  }
}

function bindPlayerListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  const { player } = getPlayer();

  player.on('ended', () => advance('ended'));

  player.on('loadedmetadata', () => {
    state.durationSeconds = effectiveDuration();
    notify();
  });

  player.on('timeupdate', () => {
    const seconds = player.currentTime() ?? 0;
    const lessonId = state.playingLessonId;
    const videoId = state.currentVideoId;
    if (lessonId != null && videoId != null) {
      wiring?.savePosition(lessonId, videoId, seconds);
    }
    // Our own chrome has no video.js progress bar to fall back on, so position
    // has to be pushed into the snapshot rather than read off the DOM.
    state.positionSeconds = seconds;
    if (state.durationSeconds <= 0) state.durationSeconds = effectiveDuration();
    notify();
    // Demo clip windows advance through the same guarded path as a real
    // `ended`, so they exercise the guards rather than bypassing them.
    const demoEnd = currentVideo()?.demo_end_at_seconds;
    if (demoEnd && seconds >= demoEnd) advance('demo-end');
  });

  player.on('play', () => {
    state.playing = true;
    state.started = true;
    state.hasPlayed = true;
    notify();
    void applyDock();
  });
  player.on('pause', () => {
    state.playing = false;
    notify();
  });

  // The picture-in-picture window can be closed from its own controls, which
  // leaves playback running with no visible player — reflect that immediately.
  player.on('leavepictureinpicture', () => {
    if (state.dock === 'pip') state.dock = 'parked';
    notify();
  });
  player.on('enterpictureinpicture', () => {
    state.dock = 'pip';
    state.pipRefused = false;
    notify();
  });
}

function releaseAdvanceLock(): void {
  advancing = false;
  if (advanceReleaseTimer !== null) {
    window.clearTimeout(advanceReleaseTimer);
    advanceReleaseTimer = null;
  }
}

/**
 * Move to the next playable lesson. The route only follows when the mode says
 * it should — browsing away from a lesson that then ends must not drag your
 * page along with the media.
 */
function advance(_reason: string, { force = false }: { force?: boolean } = {}): void {
  const from = state.playingLessonId;
  if (advancing || from == null || !wiring) return;

  if (!state.autoplayNext && !force) {
    state.pendingNext = true;
    notify();
    return;
  }

  const action = decideAdvanceTarget({
    mode: state.advanceMode,
    isFollowingAlong: routeLessonId === from,
  });

  if (action === 'stop' && !force) {
    // A demo window is an artificial ending, so stop there the way a real one
    // would — otherwise the clip rolls on to its full duration and "stop at the
    // end" never stops. After a genuine `ended` the player is already paused.
    getPlayer().player.pause();
    state.pendingNext = true;
    notify();
    return;
  }

  const next = wiring.nextLessonFor(from);
  if (!next) {
    state.courseComplete = true;
    notify();
    return;
  }

  const video = wiring.videoFor(next);
  const course = wiring.courseFor(next);
  if (!video || !course) return;

  advancing = true;
  wiring.onLessonCompleted(from);

  // Set the source before navigating so the media never waits on React.
  setLesson(next, video, { autoplay: true });
  if (action === 'advance-and-navigate' || force) {
    navigateTo(wiring.lessonPath(course, next));
  }

  const { player } = getPlayer();
  player.one('loadstart', releaseAdvanceLock);
  // A wedged flag would silently kill every later advance, so it always frees.
  advanceReleaseTimer = window.setTimeout(releaseAdvanceLock, ADVANCE_RELEASE_MS);
}
