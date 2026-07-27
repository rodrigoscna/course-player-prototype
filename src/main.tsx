import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import 'video.js/dist/video-js.css';
import './index.css';
import { PlayerHost } from './player/PlayerHost';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerHost>
      <RouterProvider router={router} />
    </PlayerHost>
  </StrictMode>,
);
