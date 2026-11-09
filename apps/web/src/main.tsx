import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { queryClient } from './app/query-client.ts';
import { createAppRouter } from './app/router.tsx';
import './styles/tailwind.css';

// Entry of web-ui (CU-042): React with the query client and the router.
const container = document.getElementById('root');
if (!container) throw new Error('Element #root is missing in index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={createAppRouter()} />
    </QueryClientProvider>
  </StrictMode>,
);
