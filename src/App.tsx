import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { PrivateArea } from './ui/PrivateArea';
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
      {
        path: 'entrar',
        lazy: async () => ({
          Component: (await import('./pages/Auth')).LoginPage,
        }),
      },
      {
        path: 'cadastro',
        lazy: async () => ({
          Component: (await import('./pages/Auth')).RegisterPage,
        }),
      },
      { path: 'catalogo', lazy: () => import('./pages/Catalog') },
      { path: 'materiais/:id', lazy: () => import('./pages/Detail') },
      {
        element: <PrivateArea role="STUDENT" />,
        children: [
          {
            path: 'doar',
            lazy: async () => ({
              Component: (await import('./pages/Donations')).DonatePage,
            }),
          },
          {
            path: 'minhas-doacoes',
            lazy: async () => ({
              Component: (await import('./pages/Donations')).DonationsPage,
            }),
          },
        ],
      },
      {
        element: <PrivateArea role="STAFF" />,
        children: [
          {
            path: 'instituicao',
            lazy: async () => ({
              Component: (await import('./pages/Institution')).InstitutionPage,
            }),
          },
          {
            path: 'instituicao/recebimentos',
            lazy: async () => ({
              Component: (await import('./pages/Institution')).ReceiptsPage,
            }),
          },
          {
            path: 'instituicao/estoque',
            lazy: async () => ({
              Component: (await import('./pages/Institution')).StockPage,
            }),
          },
        ],
      },
      {
        element: <PrivateArea />,
        children: [
          {
            path: 'perfil',
            lazy: async () => ({
              Component: (await import('./pages/Profile')).ProfilePage,
            }),
          },
        ],
      },
      { path: '*', element: <StatePanel kind="missing" /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
