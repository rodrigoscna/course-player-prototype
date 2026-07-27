import type { VideoPositions } from '../types/coursework';

/**
 * Resume positions keyed `${post_id}:${video_id}` — production's composite key,
 * which is why the videos payload is separate from the coursework payload.
 *
 * Lesson 1004 is seeded mid-clip so a hard reload onto it demonstrates
 * resume-where-you-left-off rather than starting over.
 */
export const videoPositions: VideoPositions = {
  '1004:9002': 3.2,
};

export const positionKey = (postId: number, videoId: number) => `${postId}:${videoId}`;
