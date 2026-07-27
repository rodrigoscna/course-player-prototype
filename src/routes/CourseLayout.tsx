import { Link, Outlet, useParams } from 'react-router-dom';
import { TableOfContents } from '../components/TableOfContents';
import { courseDataBySlug } from '../store/courseData';

/**
 * Wraps every lesson in a course. This layout persists across lesson
 * navigations, so the table of contents never unmounts and the player slot in
 * the outlet is not disturbed.
 */
export function CourseLayout() {
  const { courseSlug } = useParams();
  const data = courseDataBySlug(courseSlug);

  if (!data) {
    return (
      <div className="page page-narrow">
        <h1>Course not found</h1>
        <Link to="/">Back to courses</Link>
      </div>
    );
  }

  return (
    <div className="course-shell">
      <aside className="course-sidebar">
        <Link to="/" className="back-link">
          All courses
        </Link>
        <h2 className="sidebar-title">{data.course.title}</h2>
        <TableOfContents data={data} />
      </aside>

      <section className="course-content">
        <Outlet />
      </section>
    </div>
  );
}
