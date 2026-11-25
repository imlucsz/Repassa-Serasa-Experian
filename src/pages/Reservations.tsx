import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock3,
  Copy,
  MapPin,
  RefreshCw,
  Ticket,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { categoryLabels, type Page } from '../data/contract';
import {
  cancelReservation,
  listMyReservations,
  type HistoryReservation,
} from '../data/myReservations';
import { OperationError } from '../data/operations';
import { MaterialCover } from '../components/MaterialCover';
import './donations.css';
import './reservations.css';

const labels = {
  ACTIVE: 'Aguardando retirada',
  EXPIRED: 'Prazo encerrado',
  COMPLETED: 'Retirada concluída',
  CANCELED: 'Cancelada',
} as const;

const spDate = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
});
const spDeadline = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function timeRemaining(milliseconds: number) {
  const minutes = Math.ceil(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours === 0)
    return minutes === 1 ? 'Último minuto' : `Restam ${minutes} min`;
  const remainder = minutes % 60;
  return `Restam ${hours} h${remainder ? ' e ' + remainder + ' min' : ''}`;
}

function ReservationRow({
  item,
  busy,
  onCancel,
  onVerifyCode,
}: {
  item: HistoryReservation;
  busy: boolean;
  onCancel(id: string): void;
  onVerifyCode(id: string): Promise<boolean>;
}) {
  const [now, setNow] = useState(Date.now);
  const [revealed, setRevealed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState('');
  const [checking, setChecking] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const expires = Date.parse(item.expiresAt);
  const remaining = expires - Math.max(now, Date.now());
  const status =
    item.status === 'ACTIVE' && remaining <= 0 ? 'EXPIRED' : item.status;
  const active = status === 'ACTIVE';
  const { material } = item;
  const institution = material.institution;

  useEffect(() => {
    if (item.status !== 'ACTIVE') return;
    let timer: number;
    function tick() {
      const time = Date.now();
      setNow(time);
      const duration = expires - time;
      // Update the minute label, including the exact instant the code expires.
      if (duration > 0)
        timer = window.setTimeout(tick, duration % 60_000 || 60_000);
    }
    tick();
    return () => window.clearTimeout(timer);
  }, [expires, item.status]);

  useEffect(() => {
    if (confirm) keep.current?.focus();
  }, [confirm]);

  async function copy() {
    if (
      !revealed ||
      !item.pickupCode ||
      item.status !== 'ACTIVE' ||
      Date.now() >= expires
    )
      return;
    try {
      await navigator.clipboard.writeText(item.pickupCode);
      setCopied('Código copiado.');
    } catch {
      setCopied('Selecione o código para copiá-lo manualmente.');
    }
  }

  async function toggleCode() {
    if (busy) return;
    setCopied('');
    if (revealed) {
      setRevealed(false);
      return;
    }
    setChecking(true);
    try {
      setRevealed(await onVerifyCode(item.id));
    } finally {
      setChecking(false);
    }
  }

  return (
    <li>
      <article className="reservation-row" aria-labelledby={'title-' + item.id}>
        <div className="reservation-material">
          <div className="reservation-jacket">
            <MaterialCover material={material} showPhoto={false} />
          </div>
          <div className="donation-item">
            <p className="eyebrow">{categoryLabels[material.category]}</p>
            <h2 id={'title-' + item.id}>{material.title}</h2>
            <p className="donation-date">
              Reserva feita em{' '}
              <time dateTime={item.createdAt}>
                {spDate.format(new Date(item.createdAt))}
              </time>
            </p>
            <span
              className="donation-status reservation-status"
              data-status={status}
            >
              {labels[status]}
            </span>
            {status === 'COMPLETED' && item.completedAt && (
              <p className="donation-date">
                Retirado em{' '}
                <time dateTime={item.completedAt}>
                  {spDate.format(new Date(item.completedAt))}
                </time>
              </p>
            )}
          </div>
        </div>
        <div className="donation-point reservation-point">
          <MapPin size={18} aria-hidden="true" />
          <div>
            <strong>{institution.name}</strong>
            <p>{institution.publicAddress}</p>
            {active && <p>{institution.pickupInstructions}</p>}
          </div>
        </div>
        {active && (
          <div className="reservation-ticket">
            <p className="reservation-deadline">
              <Clock3 size={16} aria-hidden="true" /> {timeRemaining(remaining)}
            </p>
            <p>
              Retire até{' '}
              <time dateTime={item.expiresAt}>
                {spDeadline.format(new Date(item.expiresAt))}
              </time>{' '}
              (horário de São Paulo).
            </p>
            {item.pickupCode ? (
              <>
                <button
                  type="button"
                  className="button"
                  aria-expanded={revealed}
                  aria-disabled={busy || undefined}
                  aria-busy={checking || undefined}
                  onClick={() => void toggleCode()}
                >
                  <Ticket size={16} aria-hidden="true" />{' '}
                  {revealed
                    ? 'Ocultar código'
                    : checking
                      ? 'Verificando reserva…'
                      : 'Mostrar código'}
                </button>
                {revealed && (
                  <div className="reservation-code">
                    <span>Código de retirada</span>
                    <strong>{item.pickupCode}</strong>
                    <button
                      className="donation-text-button"
                      type="button"
                      onClick={() => void copy()}
                    >
                      <Copy size={15} aria-hidden="true" /> Copiar código
                    </button>
                    {copied && <p role="status">{copied}</p>}
                  </div>
                )}
              </>
            ) : (
              <p>Código indisponível. Atualize o histórico para consultar.</p>
            )}
            {confirm ? (
              <div
                className="donation-confirm"
                role="group"
                aria-label={'Cancelar a reserva de ' + material.title}
              >
                <strong>Cancelar esta reserva?</strong>
                <p>
                  O material voltará ao acervo e o código perderá a validade.
                </p>
                <div>
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    ref={keep}
                    onClick={() => {
                      setConfirm(false);
                      requestAnimationFrame(() =>
                        cancelButton.current?.focus(),
                      );
                    }}
                  >
                    Manter reserva
                  </button>
                  <button
                    className="button donation-danger"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (Date.now() < expires) onCancel(item.id);
                    }}
                  >
                    {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                ref={cancelButton}
                type="button"
                className="donation-text-button reservation-cancel"
                disabled={busy}
                onClick={() => {
                  setConfirm(true);
                  setRevealed(false);
                }}
              >
                Cancelar reserva
              </button>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

export function ReservationsPage() {
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Page<HistoryReservation> | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useRef<AbortController | null>(null);
  const verification = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = 'Minhas reservas · RePassa';
    const reconcile = () => {
      // Clear the private view when leaving the tab. Read current state on return.
      verification.current?.abort();
      setList(null);
      if (!document.hidden) setReload((n) => n + 1);
    };
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      document.removeEventListener('visibilitychange', reconcile);
      mutation.current?.abort();
      verification.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setList(null);
    setError('');
    listMyReservations(page, 10, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (page > 1 && result.items.length === 0) setPage(1);
        else if (!document.hidden) setList(result);
      })
      .catch((problem: unknown) => {
        if (!controller.signal.aborted)
          setError(
            problem instanceof OperationError
              ? problem.message
              : 'Não foi possível carregar suas reservas.',
          );
      });
    return () => controller.abort();
  }, [page, reload]);

  async function verifyCode(id: string) {
    if (verification.current || mutation.current) return false;
    const request = new AbortController();
    verification.current = request;
    setBusy(true);
    setNotice('');
    try {
      // A pickup at the desk or cancellation in another tab may have invalidated the code.
      const current = await listMyReservations(page, 10, request.signal);
      if (request.signal.aborted || document.hidden) return false;
      if (!current.items.length && page > 1) setPage(1);
      else setList(current);
      const row = current.items.find((item) => item.id === id);
      if (
        row?.status === 'ACTIVE' &&
        Date.parse(row.expiresAt) > Date.now() &&
        row.pickupCode
      )
        return true;
      setNotice(
        'A reserva foi atualizada e o código de retirada está indisponível.',
      );
      heading.current?.focus({ preventScroll: true });
      return false;
    } catch (problem) {
      if (!request.signal.aborted) {
        setList(null);
        setError(
          problem instanceof OperationError
            ? problem.message
            : 'Não foi possível verificar esta reserva.',
        );
        heading.current?.focus({ preventScroll: true });
      }
      return false;
    } finally {
      verification.current = null;
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (mutation.current || verification.current) return;
    const request = new AbortController();
    mutation.current = request;
    setBusy(true);
    setNotice('');
    try {
      const canceled = await cancelReservation(id, request.signal);
      if (request.signal.aborted) return;
      setList(
        (previous) =>
          previous && {
            ...previous,
            items: previous.items.map((item) =>
              item.id === id ? canceled : item,
            ),
          },
      );
      setNotice('Reserva cancelada.');
    } catch (problem) {
      if (request.signal.aborted) return;
      if (
        problem instanceof OperationError &&
        [401, 403, 429].includes(problem.status)
      )
        setNotice(problem.message);
      else if (
        problem instanceof OperationError &&
        [404, 409].includes(problem.status)
      )
        setNotice(
          'A situação da reserva mudou. Confira o histórico atualizado.',
        );
      else
        setNotice(
          'Não foi possível confirmar o cancelamento. Consulte a situação da reserva antes de tentar novamente.',
        );
      setList(null);
      setReload((n) => n + 1);
    } finally {
      mutation.current = null;
      if (!request.signal.aborted) {
        setBusy(false);
        heading.current?.focus({ preventScroll: true });
      }
    }
  }

  function changePage(next: number) {
    setList(null);
    setNotice('');
    setPage(next);
    heading.current?.focus({ preventScroll: true });
  }

  return (
    <div className="frame donation-page">
      <header className="donation-heading donation-history-heading">
        <div>
          <p className="eyebrow">
            <span className="ink-rule" /> Área do estudante
          </p>
          <h1 ref={heading} tabIndex={-1}>
            Minhas <em>reservas.</em>
          </h1>
          <p>
            Consulte o prazo e apresente o código na instituição para retirar
            seu material.
          </p>
        </div>
        <Link className="button" to="/catalogo">
          Explorar o acervo <ArrowRight size={16} />
        </Link>
      </header>
      {notice && (
        <p className="donation-notice" role="status">
          {notice}
        </p>
      )}
      {error ? (
        <div className="donation-empty" role="alert">
          <p>{error}</p>
          <button className="button" onClick={() => setReload((n) => n + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : list === null ? (
        <p className="donation-empty" role="status">
          Carregando suas reservas…
        </p>
      ) : list.items.length === 0 ? (
        <section className="donation-empty">
          <BookOpen size={32} aria-hidden="true" />
          <h2>Você ainda não fez uma reserva</h2>
          <p>
            Escolha um material disponível no acervo para combinar a retirada na
            instituição.
          </p>
        </section>
      ) : (
        <>
          <div className="reservation-tools">
            <span>
              {list.total} {list.total === 1 ? 'reserva' : 'reservas'}
            </span>
            <button
              className="donation-text-button"
              disabled={busy}
              onClick={() => {
                setNotice('');
                setReload((n) => n + 1);
                heading.current?.focus({ preventScroll: true });
              }}
            >
              <RefreshCw size={15} aria-hidden="true" /> Atualizar histórico
            </button>
          </div>
          <ul className="donation-history reservation-history">
            {list.items.map((item) => (
              <ReservationRow
                key={item.id}
                item={item}
                busy={busy}
                onCancel={cancel}
                onVerifyCode={verifyCode}
              />
            ))}
          </ul>
          {list.total > list.pageSize && (
            <nav className="pager" aria-label="Páginas de reservas">
              <button
                disabled={page === 1 || busy}
                onClick={() => changePage(page - 1)}
              >
                <ArrowLeft size={16} /> Anterior
              </button>
              <span>
                Página {list.page} de {Math.ceil(list.total / list.pageSize)}
              </span>
              <button
                disabled={page * list.pageSize >= list.total || busy}
                onClick={() => changePage(page + 1)}
              >
                Próxima <ArrowRight size={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
