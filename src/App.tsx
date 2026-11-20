import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Shell } from './ui/Shell';
import { StatePanel } from './ui/StatePanel';
import { Home } from './pages/Home';

const router = createBrowserRouter([
  {
    path: '/',
    Component: Shell,
    errorElement: (
      <StatePanel kind="error" retry={() => window.location.reload()} />
    ),
    hydrateFallbackElement: <StatePanel kind="loading" />,
    children: [
      { index: true, Component: Home },
      { path: 'catalogo', lazy: () => import('./pages/Catalog') },
      { path: 'materiais/:id', lazy: () => import('./pages/Detail') },
      { path: '*', element: <StatePanel kind="missing" /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
