import { useEffect } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useOutletContext,
} from 'react-router-dom';
import { BookOpen, Building2, ClipboardList, History, LayoutDashboard, Users } from 'lucide-react';
import { isDemo } from '../data/catalog';
import { useAuthUser, type AuthUser } from '../data/auth';
import { StatePanel } from './StatePanel';
import './account.css';

const adminLinks = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/admin/instituicoes', label: 'Instituições', icon: Building2 },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
  { to: '/admin/materiais', label: 'Materiais', icon: BookOpen },
  { to: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
  { to: '/admin/auditoria', label: 'Auditoria', icon: History },
];

export interface AccountContext {
  sessionState: 'loading' | 'ready' | 'error';
  retry(): void;
  signOut(): Promise<void>;
  leaving: boolean;
}

export function PrivateArea({ role }: { role?: AuthUser['role'] }) {
  const user = useAuthUser();
  const context = useOutletContext<AccountContext>();
  const location = useLocation();
  useEffect(() => {
    if (isDemo) document.title = 'Área de conta · RePassa';
    else if (!user && context.sessionState === 'error')
      document.title = 'Sessão indisponível · RePassa';
    else if (!user && context.sessionState === 'loading')
      document.title = 'Restaurando sessão · RePassa';
  }, [user, context.sessionState]);
  if (isDemo)
    return (
      <section className="frame account-message">
        <p className="eyebrow">Demonstração</p>
        <h1>Área de conta</h1>
        <p>
          Esta demonstração permite explorar o acervo fictício. Para doar,
          reservar ou confirmar retiradas, é preciso uma conta conectada ao serviço.
        </p>
        <Link className="button primary" to="/catalogo">
          Explorar o acervo
        </Link>
      </section>
    );
  if (!user && context.sessionState === 'loading')
    return (
      <p className="frame account-message" role="status">
        Restaurando sua sessão…
      </p>
    );
  if (!user && context.sessionState === 'error')
    return (
      <section className="frame account-message">
        <h1>Não foi possível verificar sua sessão</h1>
        <p role="alert">Confira a conexão para continuar.</p>
        <button className="button" onClick={context.retry}>
          Tentar novamente
        </button>
      </section>
    );
  if (!user)
    return (
      <Navigate
        replace
        to={
          '/entrar?returnTo=' +
          encodeURIComponent(location.pathname + location.search)
        }
      />
    );
  if (role && user.role !== role) return <StatePanel page kind="forbidden" />;
  const institution = new URLSearchParams(location.search).get('instituicao');
  const search = institution
    ? '?instituicao=' + encodeURIComponent(institution)
    : '';
  return (
    <div key={user.id}>
      {role === 'STAFF' && (
        <nav
          className="frame account-nav institution-tabs"
          aria-label="Operações da instituição"
        >
          <NavLink end to={'/instituicao' + search}>
            Visão geral
          </NavLink>
          <NavLink to={'/instituicao/recebimentos' + search}>
            Recebimentos
          </NavLink>
          <NavLink to={'/instituicao/estoque' + search}>Estoque</NavLink>
          <NavLink to={'/instituicao/retirada' + search}>Retiradas</NavLink>
        </nav>
      )}
      {role === 'ADMIN' && (
        <nav className="frame admin-nav" aria-label="Administração">
          {adminLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/admin'}>
              <Icon size={16} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
      <Outlet context={context} />
    </div>
  );
}
