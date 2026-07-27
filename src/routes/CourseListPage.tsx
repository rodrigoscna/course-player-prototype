import { Link } from 'react-router-dom';
import { allCourses, courseDataFor } from '../store/courseData';

export function CourseListPage() {
  return (
    <div className="page page-narrow">
      <h1>Courses</h1>
      <p className="lede">
        Each course plays its lessons continuously: one player instance follows you
        from lesson to lesson instead of being rebuilt on every page.
      </p>

      <ul className="course-list">
        {allCourses().map((course) => {
          const data = courseDataFor(course.space_id);
          const playableCount = data?.playable.length ?? 0;

          return (
            <li key={course.space_id} className="course-card">
              <h2>
                <Link to={`/courses/${course.slug}`}>{course.title}</Link>
              </h2>
              <p>{course.description}</p>
              <p className="meta">
                {playableCount} {playableCount === 1 ? 'video lesson' : 'video lessons'}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
