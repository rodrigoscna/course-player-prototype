import type { VideoRecord } from '../types/coursework';

/**
 * A separate payload keyed by video id, because in production the URL lives on
 * the media asset rather than the coursework record — the coursework item only
 * carries `trigger_complete_video_id`.
 *
 * Every URL here was checked to return HTTP 206 with Range support. Avoid the
 * `gtv-videos-bucket` clips that most tutorials use (BigBuckBunny.mp4 and
 * friends): they now return 403 AccessDenied.
 *
 * Every clip must carry an audio track. Chrome pauses video-only media as soon
 * as the tab stops being visible ("video-only background media was paused to
 * save power"), which is precisely the case a floating player exists to serve —
 * a silent clip cannot demonstrate continuity because the browser stops it.
 * Verify with `video.webkitAudioDecodedByteCount > 0` after a brief play; the
 * `test-videos.co.uk` clips fail this.
 *
 * Check a candidate by playing it for several seconds and confirming
 * `currentTime` passes 3 with no `video.error`. Reaching `loadedmetadata` proves
 * nothing: `media.w3.org/2010/05/bunny/movie.mp4` loads and decodes its first
 * second, then dies with PIPELINE_ERROR_DECODE.
 *
 * `demo_end_at_seconds` cuts long clips short so a full course plays through in
 * well under a minute.
 */
export const videos: Record<number, VideoRecord> = {
  9001: {
    id: 9001,
    url: 'https://mdn.github.io/shared-assets/videos/flower.mp4',
    type: 'video/mp4',
    duration_seconds: 5,
  },
  9002: {
    id: 9002,
    url: 'https://mdn.github.io/shared-assets/videos/friday.mp4',
    type: 'video/mp4',
    duration_seconds: 6,
  },
  9003: {
    id: 9003,
    url: 'https://mdn.github.io/shared-assets/videos/tears-of-steel-battle-clip-medium.mp4',
    type: 'video/mp4',
    duration_seconds: 71,
    demo_end_at_seconds: 10,
  },
  // Flagged audio-only so the floating player's small state is reachable from the
  // data rather than only from the collapse button. "Room Tone" is a lesson about
  // recording sound, so audio-first is what it would really be. The flag changes
  // presentation only — the clip still carries the audio track every clip needs.
  9004: {
    id: 9004,
    url: 'https://media.w3.org/2010/05/video/movie_300.mp4',
    type: 'video/mp4',
    duration_seconds: 300,
    demo_end_at_seconds: 10,
    audio_only: true,
  },
  9005: {
    id: 9005,
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    type: 'video/mp4',
    duration_seconds: 47,
    demo_end_at_seconds: 10,
  },
  // Referenced only by the hidden lesson, so it should never play.
  9006: {
    id: 9006,
    url: 'https://mdn.github.io/shared-assets/videos/flower.mp4',
    type: 'video/mp4',
    duration_seconds: 5,
  },
  9007: {
    id: 9007,
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    type: 'video/mp4',
    duration_seconds: 47,
    demo_end_at_seconds: 9,
  },
  9008: {
    id: 9008,
    url: 'https://mdn.github.io/shared-assets/videos/tears-of-steel-battle-clip-medium.mp4',
    type: 'video/mp4',
    duration_seconds: 70,
    demo_end_at_seconds: 9,
  },
  9009: {
    id: 9009,
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    type: 'video/mp4',
    duration_seconds: 52,
    demo_end_at_seconds: 9,
  },
  // A YouTube-hosted lesson. `video/youtube` routes the same `player.src()` call
  // through the videojs-youtube tech, which swaps the player's inner element for
  // an iframe — the tech-switch boundary (MP4 → YouTube) is exactly what this
  // entry exists to exercise. The HTTP-206 checklist above does not apply here;
  // what matters instead is that the video allows embedding.
  9010: {
    id: 9010,
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    type: 'video/youtube',
    duration_seconds: 19,
    demo_end_at_seconds: 9,
  },
};

export const videoById = (id: number | null | undefined): VideoRecord | null =>
  (id != null && videos[id]) || null;
