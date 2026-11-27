import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { PrivateArea } from './ui/PrivateArea';
import { Shell } from './ui/Shell';
import { StatePanel } from './ui/StatePanel';
import { Home } from './pages/Home';

function PickupRedirect() {
  const { search } = useLocation();
  return <Navigate to={'/instituicao/retirada' + search} replace />;
}

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
        path: 'preview/home-cinematica',
        lazy: async () => ({
          Component: (await import('./pages/CinematicHome')).CinematicHome,
        }),
      },
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
      { path: 'instituicao/retiradas', Component: PickupRedirect },
      {
        element: <PrivateArea role="STUDENT" />,
        children: [
          {
            path: 'minhas-reservas',
            lazy: async () => ({
              Component: (await import('./pages/Reservations'))
                .ReservationsPage,
            }),
          },
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
            path: 'instituicao/retirada',
            lazy: async () => ({
              Component: (await import('./pages/Institution')).PickupsPage,
            }),
          },
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
        element: <PrivateArea role="ADMIN" />,
        children: [
          {
            path: 'admin',
            lazy: async () => ({
              Component: (await import('./pages/Admin')).AdminDashboardPage,
            }),
          },
          {
            path: 'admin/instituicoes',
            lazy: async () => ({
              Component: (await import('./pages/AdminInstitutions'))
                .AdminInstitutionsPage,
            }),
          },
          {
            path: 'admin/instituicoes/:id',
            lazy: async () => ({
              Component: (await import('./pages/AdminInstitutions'))
                .AdminInstitutionDetailPage,
            }),
          },
          {
            path: 'admin/usuarios',
            lazy: async () => ({
              Component: (await import('./pages/AdminUsers')).AdminUsersPage,
            }),
          },
          {
            path: 'admin/materiais',
            lazy: async () => ({
              Component: (await import('./pages/AdminViews'))
                .AdminMaterialsPage,
            }),
          },
          {
            path: 'admin/reservas',
            lazy: async () => ({
              Component: (await import('./pages/AdminViews'))
                .AdminReservationsPage,
            }),
          },
          {
            path: 'admin/auditoria',
            lazy: async () => ({
              Component: (await import('./pages/AdminViews')).AdminAuditPage,
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
          {
            path: 'instituicoes/nova',
            lazy: async () => ({
              Component: (await import('./pages/RegisterInstitution'))
                .RegisterInstitutionPage,
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
