import { createBrowserRouter } from 'react-router-dom';
import { setNavigator } from './player/navigation';
import { CourseIndexRedirect } from './routes/CourseIndexRedirect';
import { CourseLayout } from './routes/CourseLayout';
import { CourseListPage } from './routes/CourseListPage';
import { LessonPage } from './routes/LessonPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { RootLayout } from './routes/RootLayout';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <RootLayout />,
      errorElement: <NotFoundPage />,
      children: [
        { index: true, element: <CourseListPage /> },
        {
          path: 'courses/:courseSlug',
          element: <CourseLayout />,
          children: [
            { index: true, element: <CourseIndexRedirect /> },
            // No `key` on this route's element: within a course only the lesson
            // slug changes, so React reconciles the same page in place and the
            // player element never moves at all. A key would force a remount and
            // reparent on every lesson change.
            { path: 'lessons/:lessonSlug', element: <LessonPage /> },
          ],
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  // Deployed under a repository subpath on GitHub Pages, served from the domain
  // root in dev. Taking this from Vite's `base` means the router and the asset
  // URLs are configured from one value rather than two that can disagree.
  { basename: import.meta.env.BASE_URL },
);

// The player host sits above the router and so cannot use `useNavigate`.
setNavigator((to) => void router.navigate(to));
