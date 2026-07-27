import { useLayoutEffect } from 'react';
import type { CourseworkItem, VideoRecord } from '../types/coursework';
import { controller } from './playerController';

/**
 * Tells the player which lesson page is open.
 *
 * Navigation deliberately does not start playback. The page registers itself as
 * the current route, and only claims the player when nothing is going on — so
 * arriving at a lesson while another one plays leaves that one playing.
 *
 * Depends on the lesson id rather than running once: within a course React
 * reconciles the same page across lesson routes, so this must re-run when the
 * lesson changes even though the component never remounts.
 */
export function usePlayerLesson(
  lesson: CourseworkItem | null,
  video: VideoRecord | null,
): void {
  useLayoutEffect(() => {
    controller.setRouteLesson(lesson);
    if (!lesson || !video) return;

    // A page reached by an advance already has the player loaded and playing;
    // any other arrival only claims an idle player, never a busy one.
    if (controller.getSnapshot().playingLessonId === lesson.id) return;
    controller.claimIfIdle(lesson, video);
  }, [lesson?.id, video?.id]);
}
