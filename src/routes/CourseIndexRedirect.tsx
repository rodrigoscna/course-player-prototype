import { Navigate, useParams } from 'react-router-dom';
import { lessonPath } from '../domain/selectors';
import { courseDataBySlug } from '../store/courseData';
import { progressStore } from '../store/progressStore';

/**
 * Sends `/courses/:slug` to wherever the member left off, falling back to the
 * first playable lesson.
 */
export function CourseIndexRedirect() {
  const { courseSlug } = useParams();
  const data = courseDataBySlug(courseSlug);
  if (!data) return <Navigate to="/" replace />;

  const progress = progressStore.forSpace(data.course.space_id);
  const current =
    data.playable.find((lesson) => lesson.id === progress.current) ?? data.playable[0];

  if (!current) return <Navigate to="/" replace />;
  return <Navigate to={lessonPath(data.course, current)} replace />;
}
