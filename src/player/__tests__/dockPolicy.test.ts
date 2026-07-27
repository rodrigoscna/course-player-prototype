import { describe, expect, it } from 'vitest';
import {
  decideAdvanceTarget,
  decideDock,
  decideFloatingVariant,
  decideFloatingVisible,
  type AdvanceMode,
} from '../dockPolicy';

type DockInput = Parameters<typeof decideDock>[0];

/**
 * Playing, away from the playing lesson, in native mode — the case the original
 * picture-in-picture rules were written against. Each test overrides only the
 * field it is about.
 */
const dock = (over: Partial<DockInput> = {}) =>
  decideDock({
    routeLessonId: 1005,
    playingLessonId: 1002,
    isPlaying: true,
    awaitingPlayback: false,
    isAudioOnly: false,
    floatMode: 'native-pip',
    floatingDismissed: false,
    ...over,
  });

describe('decideDock', () => {
  it('parks when nothing is loaded', () => {
    expect(dock({ playingLessonId: null, isPlaying: false })).toBe('parked');
  });

  it('docks inline on the lesson that is loaded, playing or not', () => {
    expect(dock({ routeLessonId: 1002, isPlaying: true })).toBe('inline');
    expect(dock({ routeLessonId: 1002, isPlaying: false })).toBe('inline');
  });

  it('goes to picture-in-picture when you browse away from a playing lesson', () => {
    expect(dock()).toBe('pip');
  });

  it('parks when you browse away from a paused lesson', () => {
    expect(dock({ isPlaying: false })).toBe('parked');
  });

  it('parks on a page that is not a lesson at all', () => {
    expect(dock({ routeLessonId: null })).toBe('pip');
    expect(dock({ routeLessonId: null, playingLessonId: null, isPlaying: false })).toBe(
      'parked',
    );
  });

  describe('custom float mode', () => {
    const custom = (over: Partial<DockInput> = {}) =>
      dock({ floatMode: 'custom', ...over });

    it('floats instead of asking the browser for a window', () => {
      expect(custom()).toBe('floating');
    });

    it('parks when paused, because a stopped card is showing nothing', () => {
      expect(custom({ isPlaying: false })).toBe('parked');
    });

    it('parks audio rather than moving the element into a covered box', () => {
      expect(custom({ isAudioOnly: true })).toBe('parked');
    });

    it('holds the container across a boundary that has not started playing yet', () => {
      // An advance sets a new source before it plays. Parking in that gap would
      // tear the container down and rebuild it at every lesson boundary.
      expect(custom({ isPlaying: false, awaitingPlayback: true })).toBe('floating');
    });

    it('parks once the user closes it', () => {
      expect(custom({ floatingDismissed: true })).toBe('parked');
    });

    it('still docks inline on the playing lesson, dismissed or not', () => {
      expect(custom({ routeLessonId: 1002, floatingDismissed: true })).toBe('inline');
    });
  });
});

describe('decideFloatingVariant', () => {
  it('is tall for video on a page you are not looking at', () => {
    expect(decideFloatingVariant({ onMediaPage: false, isAudioOnly: false })).toBe('tall');
  });

  it('is short on the media its own page, where the video is already inline', () => {
    expect(decideFloatingVariant({ onMediaPage: true, isAudioOnly: false })).toBe('short');
  });

  it('is short for audio, which has no picture either way', () => {
    expect(decideFloatingVariant({ onMediaPage: false, isAudioOnly: true })).toBe('short');
    expect(decideFloatingVariant({ onMediaPage: true, isAudioOnly: true })).toBe('short');
  });
});

describe('decideFloatingVisible', () => {
  const visible = (over = {}) =>
    decideFloatingVisible({
      playingLessonId: 1002,
      isPlaying: true,
      awaitingPlayback: false,
      floatMode: 'custom',
      floatingDismissed: false,
      ...over,
    });

  it('shows while something is playing', () => {
    expect(visible()).toBe(true);
  });

  it('shows across a boundary that has not started playing yet', () => {
    expect(visible({ isPlaying: false, awaitingPlayback: true })).toBe(true);
  });

  it('hides when nothing is playing', () => {
    expect(visible({ isPlaying: false })).toBe(false);
  });

  it('hides with nothing loaded', () => {
    expect(visible({ playingLessonId: null })).toBe(false);
  });

  it('hides once closed', () => {
    expect(visible({ floatingDismissed: true })).toBe(false);
  });

  it('hides in native mode, where the browser draws its own window', () => {
    expect(visible({ floatMode: 'native-pip' })).toBe(false);
  });
});

describe('decideAdvanceTarget', () => {
  const modes: AdvanceMode[] = ['keep-route', 'follow', 'stop'];

  it('navigates in every mode while you are watching the lesson that ended', () => {
    modes.forEach((mode) => {
      expect(decideAdvanceTarget({ mode, isFollowingAlong: true })).toBe(
        'advance-and-navigate',
      );
    });
  });

  it('advances without moving your page in keep-route mode', () => {
    expect(decideAdvanceTarget({ mode: 'keep-route', isFollowingAlong: false })).toBe(
      'advance-only',
    );
  });

  it('moves the route with the media in follow mode', () => {
    expect(decideAdvanceTarget({ mode: 'follow', isFollowingAlong: false })).toBe(
      'advance-and-navigate',
    );
  });

  it('halts at the end of the clip in stop mode', () => {
    expect(decideAdvanceTarget({ mode: 'stop', isFollowingAlong: false })).toBe('stop');
  });
});
