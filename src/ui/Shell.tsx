import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigation,
  ScrollRestoration,
} from 'react-router-dom';
import { ArrowDownRight, BookOpen } from 'lucide-react';

import { isDemo } from '../data/catalog';

export function Shell() {
  const main = useRef<HTMLElement>(null);
  const { pathname, hash } = useLocation();
  const lastPath = useRef(pathname);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    if (lastPath.current !== pathname && !hash)
      main.current?.focus({ preventScroll: true });
    lastPath.current = pathname;
  }, [pathname, hash]);
  useEffect(() => {
    if (hash === '#como-funciona')
      document.getElementById('como-funciona')?.focus({ preventScroll: true });
  }, [hash, pathname]);
  return (
    <>
      <a href="#principal" className="skip">
        Pular para o conteúdo
      </a>
      <header className="masthead">
        <div className="frame masthead-row">
          <Link className="brand" to="/" aria-label="RePassa, início">
            <img
              src="/brand/repassa.webp"
              alt="RePassa"
              width="147"
              height="36"
            />
          </Link>
          <nav aria-label="Navegação principal">
            <NavLink to="/" end>
              Início
            </NavLink>
            <NavLink to="/catalogo">Acervo</NavLink>
          </nav>
          <Link className="how-link" to="/#como-funciona">
            Como funciona <ArrowDownRight size={16} />
          </Link>
        </div>
      </header>
      <main id="principal" ref={main} tabIndex={-1}>
        {isDemo && (
          <p className="demo-notice">Demonstração com dados fictícios</p>
        )}
        {navigation.state === 'loading' && (
          <div role="status" className="loading-line">
            Carregando…
          </div>
        )}
        <Outlet />
      </main>
      <footer className="frame footer">
        <Link to="/" aria-label="RePassa, início">
          <img
            src="/brand/repassa.webp"
            alt="RePassa"
            width="104"
            height="26"
          />
        </Link>
        <span>
          <BookOpen size={15} /> Rede de reuso educacional
        </span>
      </footer>
      <ScrollRestoration />
    </>
  );
}
