import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigation,
} from 'react-router-dom';
import { ArrowUpRight, LogOut } from 'lucide-react';
import { logout, restoreSession, useAuthUser } from '../data/auth';
import { isDemo } from '../data/catalog';
import './shell.css';

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <Link className="site-wordmark" to="/" aria-label="RePassa, início">
      <img
        src="/brand/repassa.webp"
        alt=""
        width={small ? 108 : 136}
        height={small ? 27 : 34}
      />
    </Link>
  );
}

export function Shell() {
  const main = useRef<HTMLElement>(null);
  const { pathname, hash } = useLocation();
  const lastPath = useRef(pathname);
  const navigation = useNavigation();
  const user = useAuthUser();
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  const [sessionState, setSessionState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSessionState('loading');
    restoreSession().then(
      () => active && setSessionState('ready'),
      () => active && setSessionState('error'),
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  useLayoutEffect(() => {
    if (lastPath.current !== pathname && !hash)
      main.current?.focus({ preventScroll: true });
    lastPath.current = pathname;
  }, [pathname, hash]);
  useEffect(() => {
    if (hash === '#como-funciona' || hash === '#doar') {
      document.getElementById(hash.slice(1))?.focus({ preventScroll: true });
    }
  }, [hash, pathname]);

  async function signOut() {
    setLeaving(true);
    setLogoutError(false);
    try {
      await logout();
    } catch {
      setLogoutError(true);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <>
      <a href="#principal" className="skip">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="frame site-bar">
          <Wordmark />
          <nav className="site-nav" aria-label="Navegação principal">
            <NavLink to="/catalogo">Acervo</NavLink>
            <Link className="site-how" to="/#como-funciona">
              Como funciona
            </Link>
          </nav>
          {user ? (
            <button
              type="button"
              className="site-account"
              onClick={signOut}
              disabled={leaving}
            >
              {leaving ? 'Saindo…' : 'Sair'}{' '}
              <LogOut size={15} aria-hidden="true" />
            </button>
          ) : (
            <NavLink className="site-account" to="/entrar">
              Entrar <ArrowUpRight size={16} aria-hidden="true" />
            </NavLink>
          )}
        </div>
        {user && (
          <nav className="frame account-nav" aria-label="Área da conta">
            {user.role === 'STUDENT' && (
              <>
                <NavLink to="/doar">Doar material</NavLink>
                <NavLink to="/minhas-doacoes">Minhas doações</NavLink>
                <NavLink to="/minhas-reservas">Minhas reservas</NavLink>
              </>
            )}
            {user.role === 'STAFF' && (
              <NavLink to="/instituicao">Instituição</NavLink>
            )}
            {user.role === 'ADMIN' && (
              <NavLink to="/admin">Administração</NavLink>
            )}
            <NavLink to="/perfil">Meu perfil</NavLink>
          </nav>
        )}
        {logoutError && (
          <div className="frame session-error" role="alert">
            <p>
              A sessão foi encerrada neste navegador. O servidor ainda precisa
              confirmar a saída.
            </p>
            <button
              type="button"
              className="button"
              onClick={signOut}
              disabled={leaving}
            >
              Tentar sair novamente
            </button>
          </div>
        )}
      </header>
      <main id="principal" ref={main} tabIndex={-1}>
        {navigation.state === 'loading' && (
          <div role="status" className="loading-line">
            Carregando…
          </div>
        )}
        <Outlet
          context={{
            sessionState,
            retry: () => setAttempt((n) => n + 1),
            signOut,
            leaving,
          }}
        />
      </main>
      <footer className="site-footer">
        <div className="frame site-colophon">
          <Wordmark small />
          <p>Rede de reuso educacional</p>
          <nav aria-label="Rodapé">
            <Link to="/#como-funciona">Como funciona</Link>
            <Link to="/catalogo">Acervo</Link>
          </nav>
          {isDemo && (
            <span className="site-edition">
              Demonstração com dados fictícios
            </span>
          )}
        </div>
      </footer>
      <ScrollRestoration />
    </>
  );
}
