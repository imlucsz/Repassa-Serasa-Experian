import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, MapPin } from 'lucide-react';
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
  type LoaderFunctionArgs,
} from 'react-router-dom';
import {
  categoryLabels,
  conditionLabels,
  getMaterial,
  isDemo,
  type Material,
} from '../data/catalog';
import { MaterialCover } from '../components/MaterialCover';
import { useAuthUser, type AuthUser } from '../data/auth';
import {
  checkReservation,
  reserveMaterial,
  type ReservationResult,
} from '../data/reservation';
import './collection.css';
export { RouteError as ErrorBoundary } from '../ui/RouteError';

export function loader({ params, request }: LoaderFunctionArgs) {
  return getMaterial(params.id ?? '', request.signal);
}
export function Component() {
  const material = useLoaderData<typeof loader>();
  const user = useAuthUser();
  return (
    <MaterialDetail
      key={material.id + ':' + (user?.id ?? 'guest')}
      material={material}
      user={user}
    />
  );
}

const deadline = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

function MaterialDetail({
  material,
  user,
}: {
  material: Material;
  user: AuthUser | null;
}) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState<ReservationResult | null>(null);
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const reservationAction = useRef<HTMLDivElement>(null);
  const historyLink = useRef<HTMLAnchorElement>(null);
  useLayoutEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    document.title = material.title + ' · RePassa';
  }, [material.title]);
  const search =
    typeof state?.catalogSearch === 'string' &&
    state.catalogSearch.startsWith('?')
      ? state.catalogSearch
      : '';
  const confirmed = result?.kind === 'confirmed' ? result : null;
  const [pastDeadline, setPastDeadline] = useState(false);
  const expired =
    pastDeadline ||
    (!!confirmed && Date.parse(confirmed.expiresAt) <= Date.now());
  useEffect(() => {
    if (!confirmed) return;
    const timer = window.setTimeout(
      () => setPastDeadline(true),
      Math.max(0, Date.parse(confirmed.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [confirmed]);
  const canReserve = !isDemo && (!user || user.role === 'STUDENT');
  const unavailable = result?.kind === 'unavailable';
  const checkOnly = result?.kind === 'uncertain';
  useEffect(() => {
    if (
      (confirmed || unavailable) &&
      (document.activeElement === document.body ||
        reservationAction.current?.contains(document.activeElement))
    )
      historyLink.current?.focus({ preventScroll: true });
  }, [confirmed, unavailable]);
  let action = 'Reservar este material';
  if (pending) action = 'Consultando…';
  else if (unavailable || !canReserve) action = 'Reserva indisponível';
  else if (checkOnly) action = 'Consultar minha reserva';
  else if (!user) action = 'Entrar para reservar';

  let message = 'A retirada é feita presencialmente na instituição.';
  if (isDemo)
    message =
      'O acervo é fictício. As reservas estão indisponíveis nesta demonstração.';
  else if (!canReserve)
    message = 'Somente estudantes podem reservar materiais.';
  else if (result && result.kind !== 'confirmed') message = result.message;
  else if (confirmed)
    message = expired
      ? 'O prazo de retirada terminou. Consulte a disponibilidade no acervo.'
      : 'Reserva confirmada. Seu código de retirada está em Minhas reservas.';

  async function reserve() {
    if (!canReserve || pending || request.current || confirmed || unavailable)
      return;
    const signIn = () =>
      navigate(
        '/entrar?returnTo=' + encodeURIComponent('/materiais/' + material.id),
      );
    if (!user) {
      void signIn();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      const operation = checkOnly ? checkReservation : reserveMaterial;
      const next = await operation(material.id, controller.signal);
      if (controller.signal.aborted) return;
      if (next.kind === 'login') void signIn();
      else setResult(next);
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }
  return (
    <article className="frame detail">
      <Link
        className="back"
        state={{ activeMaterial: material.id }}
        viewTransition
        to={'/catalogo' + search}
      >
        <ArrowLeft size={17} /> Voltar ao acervo
      </Link>
      <div className="detail-editorial">
        <header className="record-heading">
          <p className="eyebrow">
            <span className="ink-rule" />{' '}
            {isDemo ? 'Acervo demonstrativo' : 'Acervo público'} /{' '}
            {categoryLabels[material.category]}
          </p>
          <h1>{material.title}</h1>
          <dl className="record-facts">
            <div>
              <dt>Disponibilidade</dt>
              <dd>
                {confirmed
                  ? expired
                    ? 'Prazo encerrado'
                    : 'Reservado por você'
                  : unavailable || checkOnly
                    ? 'Consulte o acervo'
                    : isDemo
                      ? 'Exemplar demonstrativo'
                      : 'Disponível para reserva'}
              </dd>
            </div>
            <div>
              <dt>Condição</dt>
              <dd>{conditionLabels[material.condition]}</dd>
            </div>
          </dl>
        </header>
        <div className="detail-board">
          <div className="detail-cover">
            <MaterialCover material={material} />
          </div>
        </div>
        <section className="pickup">
          <h2>
            <MapPin size={16} aria-hidden="true" /> Ponto de retirada
          </h2>
          <h3>{material.institution.name}</h3>
          <p>{material.institution.publicAddress}</p>
          <p>{material.institution.pickupInstructions}</p>
        </section>
        <div className="reservation-action" data-confirmed={Boolean(confirmed && !expired)} ref={reservationAction}>
          {confirmed && !expired && <h2>Retirada em {material.institution.name}</h2>}
          {confirmed ? (
            <Link
              ref={historyLink}
              className="button primary"
              to="/minhas-reservas"
            >
              Ver minhas reservas{' '}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          ) : (
            <button
              className="button primary"
              type="button"
              onClick={() => void reserve()}
              disabled={!canReserve || pending || unavailable}
            >
              {action} <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          )}
          <p role="status">{message}</p>
          {confirmed && !expired && (
            <p>
              Retire até{' '}
              <time dateTime={confirmed.expiresAt}>
                {deadline.format(new Date(confirmed.expiresAt))}
              </time>{' '}
              (horário de São Paulo).
            </p>
          )}
          {(unavailable || checkOnly) && user?.role === 'STUDENT' && (
            <Link ref={historyLink} className="back" to="/minhas-reservas">
              Ver minhas reservas{' '}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        <section className="record-notes">
          <h2>Sobre o material</h2>
          <p className="detail-description">{material.description}</p>
        </section>
      </div>
    </article>
  );
}
