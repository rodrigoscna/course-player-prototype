import { describe, expect, it } from 'vitest';
import {
  decideAdvanceTarget,
  decideDock,
  decideFloatingSize,
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
    hasPlayed: true,
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

    it('keeps floating while paused, because our chrome can resume it', () => {
      expect(custom({ isPlaying: false })).toBe('floating');
    });

    it('holds the container across a boundary that has no started source yet', () => {
      // An advance sets a new source before it plays. Gating on the per-source
      // started flag here would tear the container down at every boundary.
      expect(custom({ isPlaying: false, hasPlayed: true })).toBe('floating');
    });

    it('stays parked until something has actually played', () => {
      expect(custom({ isPlaying: false, hasPlayed: false })).toBe('parked');
    });

    it('parks once the user closes it', () => {
      expect(custom({ floatingDismissed: true })).toBe('parked');
    });

    it('still docks inline on the playing lesson, dismissed or not', () => {
      expect(custom({ routeLessonId: 1002, floatingDismissed: true })).toBe('inline');
    });
  });
});

describe('decideFloatingSize', () => {
  it('uses the large state for a video you are not looking at', () => {
    expect(decideFloatingSize({ isAudioOnly: false, collapsed: false })).toBe('large');
  });

  it('shrinks when the user collapses it', () => {
    expect(decideFloatingSize({ isAudioOnly: false, collapsed: true })).toBe('small');
  });

  it('stays small for audio-only content, which has no picture to show', () => {
    expect(decideFloatingSize({ isAudioOnly: true, collapsed: false })).toBe('small');
    expect(decideFloatingSize({ isAudioOnly: true, collapsed: true })).toBe('small');
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
