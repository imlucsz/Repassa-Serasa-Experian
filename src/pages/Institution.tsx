import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  MapPin,
  PackageCheck,
  Search,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  categoryLabels,
  conditionLabels,
  type Institution,
} from '../data/catalog';
import { useAuthUser } from '../data/auth';
import {
  getDashboard,
  listManagedMaterials,
  listMemberships,
  receiveMaterial,
  rejectMaterial,
  statusLabels,
  type ManagedMaterial,
  type MaterialStatus,
} from '../data/operations';
import { Field } from '../ui/Field';
import { PickupDesk } from './PickupDesk';
import './institution.css';

type Read<T> = { data: T } | { error: unknown } | null;

function useRead<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    load: typeof load;
    attempt: number;
    value: Read<T>;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    function finish(value: Read<T>) {
      if (!controller.signal.aborted) setResult({ load, attempt, value });
    }
    load(controller.signal).then(
      (data) => finish({ data }),
      (error) => finish({ error }),
    );
    return () => controller.abort();
  }, [load, attempt]);
  return {
    result:
      result?.load === load && result.attempt === attempt ? result.value : null,
    refresh: () => setAttempt((previous) => previous + 1),
  };
}

function messageFor(error: unknown) {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? error.status
      : undefined;
  switch (status) {
    case 400:
      return 'Revise os dados informados e tente novamente.';
    case 401:
      return 'Sua sessão expirou. Entre novamente para continuar.';
    case 403:
      return 'Você não tem acesso a esta instituição.';
    case 404:
      return 'Esta instituição ou material está indisponível.';
    case 409:
      return 'A situação do material mudou. Confira a lista atualizada.';
    case 429:
      return 'Muitas solicitações. Aguarde um momento e tente novamente.';
    default:
      return 'Não foi possível concluir a solicitação. Confira sua conexão e tente novamente.';
  }
}

function ReadState<T>({
  result,
  refresh,
  children,
}: {
  result: Read<T>;
  refresh: () => void;
  children: (data: T) => ReactNode;
}) {
  if (!result)
    return (
      <p className="inst-message" role="status">
        Carregando dados da instituição…
      </p>
    );
  if ('error' in result)
    return (
      <div className="inst-message">
        <p role="alert">{messageFor(result.error)}</p>
        <button className="button" onClick={refresh}>
          Tentar novamente
        </button>
      </div>
    );
  return children(result.data);
}

function InstitutionScope({
  title,
  children,
}: {
  title: string;
  children: (institution: Institution) => ReactNode;
}) {
  const user = useAuthUser();
  return (
    <MemberScope key={user?.id} title={title}>
      {children}
    </MemberScope>
  );
}
function MemberScope({
  title,
  children,
}: {
  title: string;
  children: (institution: Institution) => ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const { result, refresh } = useRead(listMemberships);
  useEffect(() => {
    document.title = title + ' · RePassa';
  }, [title]);
  return (
    <section className="frame inst-page">
      <header className="page-intro">
        <p className="eyebrow">
          <Building2 size={16} aria-hidden="true" /> Área da instituição
        </p>
        <h1>{title}</h1>
      </header>
      <ReadState result={result} refresh={refresh}>
        {(memberships) => {
          if (!memberships.length)
            return (
              <p className="inst-message" role="status">
                Sua conta ainda não está vinculada a uma instituição.
              </p>
            );
          const requested = params.get('instituicao');
          const current = requested
            ? memberships.find((m) => m.id === requested)
            : memberships[0];
          function select(id: string) {
            const next = new URLSearchParams(params);
            next.set('instituicao', id);
            setParams(next, { replace: true });
          }
          return (
            <>
              <div className="inst-unit">
                {memberships.length > 1 || !current ? (
                  <Field id="staff-institution" label="Instituição">
                    <select
                      id="staff-institution"
                      value={current?.id ?? ''}
                      onChange={(event) => select(event.target.value)}
                    >
                      {!current && (
                        <option value="" disabled>
                          Selecione uma instituição
                        </option>
                      )}
                      {memberships.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <strong>{current.name}</strong>
                )}
                {current && (
                  <span>
                    <MapPin size={15} aria-hidden="true" />
                    {current.publicAddress}
                  </span>
                )}
              </div>
              {current ? (
                <div key={current.id}>{children(current)}</div>
              ) : (
                <p role="alert" className="inst-message">
                  Você não tem acesso à instituição selecionada. Escolha uma
                  instituição vinculada à sua conta.
                </p>
              )}
            </>
          );
        }}
      </ReadState>
    </section>
  );
}

function Summary({ institution }: { institution: Institution }) {
  const read = useCallback(
    (signal: AbortSignal) => getDashboard(institution.id, signal),
    [institution.id],
  );
  const { result, refresh } = useRead(read);
  const search = '?instituicao=' + encodeURIComponent(institution.id);
  return (
    <>
      <h2 className="inst-subtitle">Circulação de materiais</h2>
      <ReadState result={result} refresh={refresh}>
        {(counts) => (
          <dl className="inst-counts">
            <div>
              <dt>Aguardando recebimento</dt>
              <dd>{counts.pendingReceipt}</dd>
            </div>
            <div>
              <dt>Disponíveis</dt>
              <dd>{counts.available}</dd>
            </div>
            <div>
              <dt>Reservados</dt>
              <dd>{counts.reserved}</dd>
            </div>
            <div>
              <dt>Entregues</dt>
              <dd>{counts.delivered}</dd>
            </div>
          </dl>
        )}
      </ReadState>
      <div className="inst-actions">
        <Link
          className="button primary"
          to={'/instituicao/recebimentos' + search}
        >
          Conferir recebimentos <ArrowRight size={16} />
        </Link>
        <Link className="button" to={'/instituicao/estoque' + search}>
          Consultar estoque
        </Link>
        <Link className="button" to={'/instituicao/retirada' + search}>
          Registrar retirada
        </Link>
      </div>
    </>
  );
}

export function InstitutionPage() {
  return (
    <InstitutionScope title="Painel da instituição">
      {(institution) => <Summary institution={institution} />}
    </InstitutionScope>
  );
}

type Decision = 'receive' | 'reject';

function DecisionDialog({
  material,
  decision,
  close,
  settled,
}: {
  material: ManagedMaterial;
  decision: Decision;
  close: () => void;
  settled: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const flight = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const receiving = decision === 'receive';
  function dismiss() {
    ref.current?.close();
    close();
  }
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      flight.current?.abort();
      dialog.close();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current) return;
    const reason = String(
      new FormData(event.currentTarget).get('reason') ?? '',
    ).trim();
    if (!receiving && reason.length < 3) {
      setError('Informe um motivo com pelo menos 3 caracteres.');
      return;
    }
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setError('');
    try {
      if (receiving)
        await receiveMaterial(
          material.institution.id,
          material.id,
          controller.signal,
        );
      else
        await rejectMaterial(
          material.institution.id,
          material.id,
          reason,
          controller.signal,
        );
      if (!controller.signal.aborted)
        settled(
          receiving
            ? 'Recebimento confirmado. O material está disponível no acervo.'
            : 'Doação recusada. O motivo foi registrado.',
        );
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (
        failure &&
        typeof failure === 'object' &&
        'status' in failure &&
        [404, 409].includes(Number(failure.status))
      )
        settled(messageFor(failure));
      else setError(messageFor(failure));
    } finally {
      flight.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <dialog
      className="inst-dialog"
      ref={ref}
      aria-labelledby="decision-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) dismiss();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="decision-title">
          {receiving ? 'Confirmar recebimento' : 'Recusar doação'}
        </h2>
        <p>
          <strong>{material.title}</strong>
          <br />
          {material.institution.name}
        </p>
        {receiving ? (
          <label className="inst-check">
            <input type="checkbox" required />
            Conferi o material e confirmo que ele chegou à instituição.
          </label>
        ) : (
          <Field id="staff-reason" label="Motivo da recusa">
            <textarea
              id="staff-reason"
              name="reason"
              minLength={3}
              maxLength={240}
              required
              rows={3}
              autoFocus
            />
          </Field>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="inst-actions">
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={dismiss}
          >
            Voltar
          </button>
          <button className="button primary" disabled={busy}>
            {busy
              ? 'Registrando…'
              : receiving
                ? 'Confirmar recebimento'
                : 'Confirmar recusa'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
function formatDate(value: string) {
  return date.format(new Date(value));
}

function MaterialList({
  institution,
  receipts,
}: {
  institution: Institution;
  receipts: boolean;
}) {
  const [filters, setFilters] = useState<{
    q: string;
    status: MaterialStatus | '';
    page: number;
  }>({ q: '', status: '', page: 1 });
  const [decision, setDecision] = useState<{
    material: ManagedMaterial;
    kind: Decision;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const message = useRef<HTMLParagraphElement>(null);
  const read = useCallback(
    (signal: AbortSignal) =>
      listManagedMaterials(
        institution.id,
        {
          q: filters.q || undefined,
          status: receipts ? 'PENDING_RECEIPT' : filters.status || undefined,
          page: filters.page,
          pageSize: 12,
        },
        signal,
      ),
    [filters, institution.id, receipts],
  );
  const { result, refresh } = useRead(read);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get('status') ?? '');
    setFilters({
      q: String(form.get('q') ?? '').trim(),
      status: Object.hasOwn(statusLabels, status)
        ? (status as MaterialStatus)
        : '',
      page: 1,
    });
    setNotice('');
  }
  function settled(text: string) {
    setDecision(null);
    setNotice(text);
    if (
      result &&
      'data' in result &&
      result.data.items.length === 1 &&
      filters.page > 1
    ) {
      setFilters((previous) => ({ ...previous, page: previous.page - 1 }));
    } else refresh();
    requestAnimationFrame(() => message.current?.focus());
  }
  return (
    <>
      <p className="inst-description">
        {receipts
          ? 'Confira a doação presencialmente antes de liberar o material no acervo.'
          : 'Consulte os materiais da instituição e acompanhe a situação de cada doação.'}
      </p>
      <form className="inst-filters" onSubmit={filter}>
        <Field id="staff-search" label="Buscar material">
          <span className="input-icon">
            <Search size={16} aria-hidden="true" />
            <input
              id="staff-search"
              type="search"
              name="q"
              maxLength={120}
              placeholder="Título ou palavra-chave"
            />
          </span>
        </Field>
        {!receipts && (
          <Field id="staff-status" label="Situação">
            <select id="staff-status" name="status">
              <option value="">Todas as situações</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <button className="button" type="submit">
          Filtrar
        </button>
      </form>
      <p
        className={notice ? 'inst-notice' : ''}
        role="status"
        tabIndex={-1}
        ref={message}
      >
        {notice}
      </p>
      <ReadState result={result} refresh={refresh}>
        {(page) => (
          <>
            {page.items.length === 0 ? (
              <p className="inst-message" role="status">
                {filters.q || filters.status
                  ? 'Nenhum material corresponde aos filtros.'
                  : receipts
                    ? 'Nenhuma doação aguardando recebimento.'
                    : 'O estoque desta instituição está vazio.'}
              </p>
            ) : (
              <>
                <p className="inst-total" role="status">
                  {page.total} {page.total === 1 ? 'material' : 'materiais'}
                </p>
                <ul className="inst-list">
                  {page.items.map((item) => (
                    <li key={item.id}>
                      <div className="inst-material">
                        <p className="meta">{categoryLabels[item.category]}</p>
                        <h2>{item.title}</h2>
                        <p>
                          {conditionLabels[item.condition]} · Cadastrado em{' '}
                          {formatDate(item.createdAt)}
                        </p>
                        {receipts && <p>{item.description}</p>}
                        {!receipts && (
                          <details>
                            <summary>Dados da doação</summary>
                            <p>{item.description}</p>
                            {item.receivedAt && (
                              <p>Recebido em {formatDate(item.receivedAt)}</p>
                            )}
                            {item.rejectReason && (
                              <p>Motivo da recusa: {item.rejectReason}</p>
                            )}
                            <p>
                              Última atualização em {formatDate(item.updatedAt)}
                            </p>
                          </details>
                        )}
                      </div>
                      {receipts ? (
                        <div className="inst-actions">
                          <button
                            className="button primary"
                            onClick={() =>
                              setDecision({ material: item, kind: 'receive' })
                            }
                          >
                            <Check size={16} />
                            Receber
                          </button>
                          <button
                            className="button"
                            onClick={() =>
                              setDecision({ material: item, kind: 'reject' })
                            }
                          >
                            Recusar
                          </button>
                        </div>
                      ) : (
                        <span className="inst-status">
                          <PackageCheck size={15} />
                          {statusLabels[item.status]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {(page.page > 1 || page.page * page.pageSize < page.total) && (
              <nav className="pager" aria-label="Paginação de materiais">
                <button
                  disabled={page.page <= 1}
                  onClick={() =>
                    setFilters((previous) => ({
                      ...previous,
                      page: previous.page - 1,
                    }))
                  }
                >
                  Anterior
                </button>
                <span>Página {page.page}</span>
                <button
                  disabled={page.page * page.pageSize >= page.total}
                  onClick={() =>
                    setFilters((previous) => ({
                      ...previous,
                      page: previous.page + 1,
                    }))
                  }
                >
                  Próxima
                </button>
              </nav>
            )}
          </>
        )}
      </ReadState>
      {decision && (
        <DecisionDialog
          material={decision.material}
          decision={decision.kind}
          close={() => setDecision(null)}
          settled={settled}
        />
      )}
    </>
  );
}

export function ReceiptsPage() {
  return (
    <InstitutionScope title="Recebimentos">
      {(institution) => <MaterialList institution={institution} receipts />}
    </InstitutionScope>
  );
}

export function StockPage() {
  return (
    <InstitutionScope title="Estoque">
      {(institution) => (
        <MaterialList institution={institution} receipts={false} />
      )}
    </InstitutionScope>
  );
}

export function PickupsPage() {
  return (
    <InstitutionScope title="Retiradas">
      {(institution) => <PickupDesk institution={institution} />}
    </InstitutionScope>
  );
}
