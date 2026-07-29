import type { Course, CourseworkItem, VideoRecord } from '../types/coursework';
import {
  decideAdvanceTarget,
  decideDock,
  decideFloatingVariant,
  decideFloatingVisible,
  type AdvanceMode,
  type DockTarget,
  type FloatingVariant,
  type FloatMode,
} from './dockPolicy';
import type Player from 'video.js/dist/types/player';
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
  /** Which of the design's two floating players is showing. */
  floatingVariant: FloatingVariant;
  /**
   * Whether the floating chrome is on screen. Not the same as `dock === 'floating'`:
   * the short bar shows while the element is docked inline or parked.
   */
  floatingVisible: boolean;
  /** The floating player was closed, so nothing floats until playback restarts. */
  floatingDismissed: boolean;
  /**
   * True while video.js is rendering no UI of its own and this app is driving it
   * entirely through its API. The headless claim, in one boolean.
   */
  headless: boolean;
  /** A source has been asked to play and has not started yet. */
  awaitingPlayback: boolean;
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
  floatingVariant: 'tall',
  floatingVisible: false,
  floatingDismissed: false,
  headless: false,
  awaitingPlayback: false,
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

  /**
   * Called by a slot after it physically moves the player element to a new
   * parent. A no-op for the HTML5 tech, which survives reparenting untouched.
   *
   * An iframe tech does not: moving an iframe in the DOM reloads its document.
   * The YouTube embed restarts from zero and, worse, keeps playing while
   * ignoring every command — the plugin's handle points into the pre-reload
   * context, so pause/seek/mute all silently die. The only way back to a
   * controllable player is to deliberately re-set the source, which rebuilds
   * the tech's handle, and then restore where playback was.
   */
  notifyElementReparented(): void {
    // A dock change can move the element twice in one commit (park to the
    // holder, claim into the new slot). Only the final resting place should
    // trigger a rebind, so defer a tick and let the newest call win.
    const token = ++reparentToken;
    queueMicrotask(() => {
      if (token !== reparentToken) return;
      rebindIframeTech();
    });
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
    state.awaitingPlayback = false;
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

  /**
   * Jump back a fixed amount. The design puts a 30-second rewind where a
   * previous-lesson button would otherwise go, which suits a listener who missed
   * a sentence better than one who wants a different lesson.
   */
  rewind(seconds: number): void {
    const { player } = getPlayer();
    const now = player.currentTime() ?? 0;
    player.currentTime(Math.max(0, now - seconds));
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
  // Armed before the source is set so the boundary is covered from the start.
  state.awaitingPlayback = autoplay;

  player.src({ src: video.url, type: video.type });

  const resume = wiring?.resumePositionFor(lesson.id, video.id) ?? 0;
  player.one('loadedmetadata', () => {
    if (resume > 1) player.currentTime(resume);
  });

  // The YouTube embed re-applies its own cookie-remembered watch position as a
  // late seek after playback starts, overriding wherever this app put the
  // playhead. This store is the only authority on where a lesson begins, so
  // for a grace window after the source is set, any position far from the
  // expected one is snapped back. It also snaps a manual scrub made within the
  // window — a tolerable demo-grade trade. The HTML5 tech starts where it is
  // told and never trips this.
  const expected = resume > 1 ? resume : 0;
  const graceEndsAt = Date.now() + 4000;
  const enforceStart = () => {
    if (Date.now() > graceEndsAt) {
      player.off('seeked', enforceStart);
      return;
    }
    const actual = player.currentTime() ?? 0;
    if (Math.abs(actual - expected) > 2.5) player.currentTime(expected);
  };
  player.one('playing', enforceStart);
  player.on('seeked', enforceStart);
  window.setTimeout(() => player.off('seeked', enforceStart), 4500);

  wiring?.onLessonStarted(lesson.id);
  void applyDock();
  notify();

  if (autoplay) void attemptPlay();
}

/**
 * Reconciles video.js's own chrome with the app's state.
 *
 * Two separate switches. `controls` is the headless one: video.js keeps its UI
 * inline, where it is the best thing available, and gives it up in the floating
 * container, where our chrome replaces it.
 *
 * Picture-in-picture is the other. In custom mode our container is the float
 * target, and offering the browser's picture-in-picture alongside it would leave
 * two float mechanisms competing for one element — pop out from the control bar
 * and the video leaves the container that is supposedly showing it. Setting the
 * element property is the actual enforcement: it also blocks Chrome's
 * context-menu route and makes `requestPip` refuse. The class only stops the
 * control bar advertising a button that would now do nothing, and it has to be
 * CSS rather than `hide()` because video.js re-shows that button on every
 * `loadedmetadata` — which is every lesson boundary.
 */
function applyPlayerChrome(target: DockTarget): void {
  const { player, el } = getPlayer();

  const headless = target === 'floating';
  player.controls(!headless);
  state.headless = headless;

  const ownsFloating = state.floatMode === 'custom';
  player.disablePictureInPicture(ownsFloating);
  el.classList.toggle('float-mode-custom', ownsFloating);
}

/**
 * Moves the player to wherever the current route and playback state put it.
 * Only the picture-in-picture transitions happen here; the inline and floating
 * cases are a slot claiming the element itself.
 */
async function applyDock(): Promise<void> {
  const isAudioOnly = currentVideo()?.audio_only === true;

  const target = decideDock({
    routeLessonId,
    playingLessonId: state.playingLessonId,
    isPlaying: state.playing,
    awaitingPlayback: state.awaitingPlayback,
    isAudioOnly,
    floatMode: state.floatMode,
    floatingDismissed: state.floatingDismissed,
  });

  const previous = state.dock;
  state.dock = target;
  state.floatingVariant = decideFloatingVariant({
    onMediaPage: routeLessonId !== null && routeLessonId === state.playingLessonId,
    isAudioOnly,
  });
  state.floatingVisible = decideFloatingVisible({
    playingLessonId: state.playingLessonId,
    isPlaying: state.playing,
    awaitingPlayback: state.awaitingPlayback,
    floatMode: state.floatMode,
    floatingDismissed: state.floatingDismissed,
  });

  applyPlayerChrome(target);

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

let reparentToken = 0;

/**
 * True while a tech rebuild is expected to fire a `play` this app never asked
 * for — videojs-youtube's init hardcodes autoplay (`setSrc(source, true)`).
 * Without this guard the rogue play re-opens the floating card that pausing
 * just closed: pause hides → hide parks → park rebuilds → rebuild autoplays →
 * playing shows the card again, forever.
 */
let roguePlayGuard = false;
let roguePlayGuardTimer: number | null = null;

function armRoguePlayGuard(): void {
  roguePlayGuard = true;
  if (roguePlayGuardTimer !== null) window.clearTimeout(roguePlayGuardTimer);
  roguePlayGuardTimer = window.setTimeout(() => {
    roguePlayGuard = false;
  }, 4000);
}

function disarmRoguePlayGuard(): void {
  roguePlayGuard = false;
  if (roguePlayGuardTimer !== null) {
    window.clearTimeout(roguePlayGuardTimer);
    roguePlayGuardTimer = null;
  }
}

/**
 * Recover a controllable player after an iframe tech was moved in the DOM.
 *
 * Re-setting the same source tears the zombie embed down and builds a fresh
 * one whose handle actually works; position, mute and play state are restored
 * from this controller's own snapshot, which is trustworthy precisely because
 * the dead embed stopped reporting the moment it reloaded.
 */
function rebindIframeTech(): void {
  const { player } = getPlayer();
  if ((player as unknown as { techName_?: string }).techName_ !== 'Youtube') return;
  const video = currentVideo();
  if (!video || state.playingLessonId === null) return;

  const resumeAt = state.positionSeconds;
  const wasMuted = state.muted || player.muted();
  const shouldPlay = state.playing || state.awaitingPlayback;

  // Keeps the floating card mounted through the reload — the tech flaps
  // paused/loading states that would otherwise hide it mid-rebind.
  state.awaitingPlayback = shouldPlay;
  notify();

  // The rebuilt tech autoplays whether asked to or not; only let that stand
  // when playback was actually running before the move.
  if (shouldPlay) disarmRoguePlayGuard();
  else armRoguePlayGuard();

  // `player.src()` is not enough here: with the type unchanged it routes into
  // the EXISTING tech instance, whose setSrc talks to the dead handle
  // (Youtube.js#setSrc → ytPlayer.cueVideoById → the pre-reload context).
  // `loadTech_` — private API, tolerable in a prototype — unloads the zombie
  // tech entirely and constructs a fresh one with a live handle.
  (player as unknown as {
    loadTech_: (techName: string, source: { src: string; type: string }) => void;
  }).loadTech_('Youtube', { src: video.url, type: video.type });

  player.one('loadedmetadata', () => {
    if (wasMuted) player.muted(true);
    if (resumeAt > 0.25) player.currentTime(resumeAt);
  });
  if (shouldPlay) void attemptPlay();
}

/** The end our own progress bar should measure against, demo window included. */
function effectiveDuration(): number {
  const end = effectiveEnd(getPlayer().player.duration());
  return Number.isFinite(end) ? end : 0;
}

/**
 * Whether playback has genuinely begun, checked by event rather than promise.
 *
 * A resolved `play()` is only proof of playback for the HTML5 tech. The YouTube
 * tech's `play()` returns immediately and the embed can refuse autoplay
 * silently — nothing rejects, nothing plays. The `playing` event is the one
 * signal every tech shares. The timeout errs long because a first YouTube load
 * also has to fetch the iframe API; a false "refused" only costs a muted retry.
 */
function playbackBegan(player: Player, timeoutMs = 2000): Promise<boolean> {
  if (!player.paused()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const settle = (began: boolean) => {
      player.off('playing', onPlaying);
      window.clearTimeout(timer);
      resolve(began);
    };
    const onPlaying = () => settle(true);
    const timer = window.setTimeout(() => settle(!player.paused()), timeoutMs);
    player.on('playing', onPlaying);
  });
}

async function attemptPlay(): Promise<void> {
  const { player } = getPlayer();
  // Every path through here is a play someone actually asked for.
  disarmRoguePlayGuard();
  try {
    await player.play();
    if (!(await playbackBegan(player))) throw new Error('refused without rejecting');
    state.autoplayBlocked = false;
    notify();
  } catch {
    // Autoplay policy refused a sound-on start. Muted playback keeps the
    // continuity visible; surface a badge so the user can unmute.
    try {
      player.muted(true);
      state.muted = true;
      await player.play();
      if (!(await playbackBegan(player))) throw new Error('refused without rejecting');
      state.autoplayBlocked = false;
    } catch {
      state.autoplayBlocked = true;
      state.awaitingPlayback = false;
    }
    notify();
  }
}

function bindPlayerListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  const { player } = getPlayer();

  player.on('ended', () => {
    // The HTML5 tech fires `pause` before `ended`, so the pause handler had
    // already cleared `playing`. The YouTube tech fires `ended` alone — without
    // this, the state machine still believes it is playing and the floating
    // player survives its own video's end, showing a Pause button over a dead
    // embed. Same rule as pausing: re-dock only in custom mode.
    state.playing = false;
    notify();
    if (state.floatMode === 'custom') void applyDock();
    advance('ended');
  });

  player.on('loadedmetadata', () => {
    state.durationSeconds = effectiveDuration();
    notify();
  });

  player.on('timeupdate', () => {
    // Mid-advance, `playingLessonId` already names the NEXT lesson while the
    // dying source can still fire a final timeupdate — the slower the tech
    // swap, the wider the window (an HTML5→YouTube switch loads the iframe API,
    // where MP4→MP4 masked this entirely). Saving that tick would file the old
    // clip's end position under the new lesson's key, so the new lesson then
    // "resumes" at the old clip's timestamp instead of starting at zero.
    if (advancing) return;
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
    // A play nobody asked for, from a tech rebuild — cancel it before it
    // reaches the state machine, or it reopens the card that pausing closed.
    if (roguePlayGuard) {
      player.pause();
      return;
    }
    state.playing = true;
    state.started = true;
    state.awaitingPlayback = false;
    notify();
    void applyDock();
  });
  player.on('pause', () => {
    state.playing = false;
    notify();
    // Pausing hides the custom bar, so the dock has to be recomputed. Deliberately
    // not in native mode: there, re-docking would call `exitPip()` and pausing from
    // the browser's own picture-in-picture window would dismiss it — a behaviour
    // change to the baseline this prototype exists to compare against.
    if (state.floatMode === 'custom') void applyDock();
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
    state.awaitingPlayback = false;
    notify();
    return;
  }

  const next = wiring.nextLessonFor(from);
  if (!next) {
    state.courseComplete = true;
    state.awaitingPlayback = false;
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
