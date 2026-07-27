import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page page-narrow">
      <h1>Nothing here</h1>
      <Link to="/">Back to courses</Link>
    </div>
  );
}
