import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useOutletContext,
} from 'react-router-dom';
import { isDemo } from '../data/catalog';
import { useAuthUser, type AuthUser } from '../data/auth';
import { StatePanel } from './StatePanel';
import './account.css';

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
  if (isDemo)
    return (
      <section className="frame account-message">
        <p className="eyebrow">Demonstração</p>
        <h1>Área de conta</h1>
        <p>
          Esta demonstração permite explorar o acervo fictício. Doações e
          operações institucionais exigem uma conta conectada ao serviço.
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
  if (role && user.role !== role) return <StatePanel kind="forbidden" />;
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
        </nav>
      )}
      <Outlet context={context} />
    </div>
  );
}
