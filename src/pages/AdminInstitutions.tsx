import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import {
  approveInstitution,
  assignInstitutionMember,
  findAdminInstitution,
  institutionStatusLabels,
  listAdminInstitutions,
  listAdminUsers,
  listInstitutionMembers,
  rejectInstitution,
  revokeInstitutionMember,
  setInstitutionActive,
  type AdminInstitution,
  type AdminMember,
  type AdminUser,
  type InstitutionStatus,
} from '../data/admin';
import { useAuthUser } from '../data/auth';
import { Field } from '../ui/Field';
import { StatePanel } from '../ui/StatePanel';
import {
  ConfirmAction,
  Pager,
  Pill,
  EmptyResults,
  ReadState,
  messageFor,
  useRead,
} from './adminShared';
import './admin.css';

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const dateTimeLong = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const PAGE_SIZE = 10;

export function institutionPill(institution: AdminInstitution) {
  const tone =
    institution.status === 'APPROVED'
      ? institution.isActive
        ? 'ok'
        : 'muted'
      : institution.status === 'PENDING'
        ? 'warn'
        : 'danger';
  const label =
    institution.status === 'APPROVED'
      ? institution.isActive
        ? 'Ativa'
        : 'Suspensa'
      : institutionStatusLabels[institution.status];
  return <Pill tone={tone}>{label}</Pill>;
}

function RejectAction({
  busy,
  onReject,
}: {
  busy: boolean;
  onReject: (reason: string) => void;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState('');
  return (
    <ConfirmAction
      label="Recusar"
      prompt="Informe a justificativa (3 a 240 caracteres)."
      confirmLabel="Recusar cadastro"
      danger
      busy={busy}
      onConfirm={() => onReject(reason.trim())}
    >
      <div className="admin-reason">
        <label htmlFor={reasonId}>Justificativa</label>
        <textarea
          id={reasonId}
          value={reason}
          minLength={3}
          maxLength={240}
          required
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </ConfirmAction>
  );
}

function PendingActions({
  institution,
  busy,
  onChange,
}: {
  institution: AdminInstitution;
  busy: boolean;
  onChange: (action: () => Promise<unknown>) => void;
}) {
  return (
    <div className="admin-actions">
      <ConfirmAction
        label="Aprovar"
        prompt={`Aprovar ${institution.name}? Ela passa a aparecer como ponto de entrega.`}
        confirmLabel="Aprovar instituição"
        busy={busy}
        onConfirm={() => onChange(() => approveInstitution(institution.id))}
      />
      <RejectAction
        busy={busy}
        onReject={(reason) =>
          onChange(() => rejectInstitution(institution.id, reason))
        }
      />
    </div>
  );
}

export function AdminInstitutionsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const isActive = params.get('isActive') ?? '';
  const query = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(query);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { result, refresh } = useRead(
    useCallback(
      (signal: AbortSignal) =>
        listAdminInstitutions(
          {
            page,
            pageSize: PAGE_SIZE,
            status: (status || undefined) as InstitutionStatus | undefined,
            isActive:
              isActive === 'true'
                ? true
                : isActive === 'false'
                  ? false
                  : undefined,
            q: query || undefined,
          },
          signal,
        ),
      [page, status, isActive, query],
    ),
  );
  useEffect(() => {
    document.title = 'Instituições | RePassa';
  }, []);

  function update(next: Record<string, string>) {
    const merged = { status, isActive, q: query, ...next };
    const entries = Object.entries(merged).filter(([, value]) => value);
    setParams(new URLSearchParams(entries), { replace: true });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ q: draft.trim(), page: '' });
  }
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      refresh();
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="frame admin-page" aria-labelledby="inst-titulo">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 id="inst-titulo">Instituições</h1>
        </div>
        <Link className="button" to="/instituicoes/nova">
          Cadastrar instituição <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>
      <form className="admin-filters" role="search" onSubmit={search}>
        <Field id="inst-q" label="Buscar por nome ou endereço">
          <input
            id="inst-q"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </Field>
        <Field id="inst-status" label="Situação do cadastro">
          <select
            id="inst-status"
            value={status}
            onChange={(event) => update({ status: event.target.value, page: '' })}
          >
            <option value="">Todas</option>
            <option value="PENDING">Pendente</option>
            <option value="APPROVED">Aprovada</option>
            <option value="REJECTED">Recusada</option>
          </select>
        </Field>
        <Field id="inst-ativa" label="Atividade">
          <select
            id="inst-ativa"
            value={isActive}
            onChange={(event) =>
              update({ isActive: event.target.value, page: '' })
            }
          >
            <option value="">Todas</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </Field>
        <button className="button" type="submit">
          <Search size={14} aria-hidden="true" /> Buscar
        </button>
      </form>
      {error && (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      )}
      <ReadState result={result} refresh={refresh}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyResults clearDraft={() => setDraft('')}>
              Nenhuma instituição encontrada com estes filtros.
            </EmptyResults>
          ) : (
            <>
              <p className="inst-total">
                {data.total}{' '}
                {data.total === 1
                  ? 'instituição encontrada'
                  : 'instituições encontradas'}
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Instituição</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Membros</th>
                      <th scope="col">Materiais</th>
                      <th scope="col">Criada em</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((institution) => (
                      <tr key={institution.id}>
                        <td data-label="Instituição">
                          <Link
                            className="admin-cell-main"
                            to={'/admin/instituicoes/' + institution.id}
                          >
                            {institution.name}
                          </Link>
                          <span className="admin-cell-sub">
                            {institution.publicAddress}
                          </span>
                        </td>
                        <td data-label="Situação">
                          {institutionPill(institution)}
                        </td>
                        <td data-label="Membros">{institution.memberCount}</td>
                        <td data-label="Materiais">
                          {institution.materialCount}
                        </td>
                        <td data-label="Criada em">
                          {dateTime.format(new Date(institution.createdAt))}
                        </td>
                        <td data-label="Ações">
                          {institution.status === 'PENDING' ? (
                            <PendingActions
                              institution={institution}
                              busy={busy}
                              onChange={run}
                            />
                          ) : (
                            <Link to={'/admin/instituicoes/' + institution.id}>
                              Detalhes
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                busy={busy || !result}
                onPage={(next) => update({ page: String(next) })}
              />
            </>
          )
        }
      </ReadState>
    </section>
  );
}

function MemberManager({ institution }: { institution: AdminInstitution }) {
  const currentUser = useAuthUser();
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const members = useRead(
    useCallback(
      (signal: AbortSignal) => listInstitutionMembers(institution.id, signal),
      [institution.id],
    ),
  );
  const candidates = useRead(
    useCallback(
      (signal: AbortSignal) =>
        search
          ? listAdminUsers({ q: search, isActive: true, pageSize: 5 }, signal)
          : Promise.resolve(null),
      [search],
    ),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draft.trim());
  }
  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError('');
    try {
      await action();
      members.refresh();
      if (candidates.result && 'data' in candidates.result)
        candidates.refresh();
    } catch (failure) {
      setError(
        failure &&
          typeof failure === 'object' &&
          'status' in failure &&
          failure.status === 409
          ? 'Não foi possível concluir: o usuário já é membro, está desativado ou é administrador.'
          : messageFor(failure),
      );
    } finally {
      setBusy(null);
    }
  }

  const memberIds = new Set(
    members.result && 'data' in members.result
      ? members.result.data.map((member) => member.userId)
      : [],
  );

  return (
    <section className="admin-section" aria-labelledby="membros-titulo">
      <h2 id="membros-titulo">Membros da equipe</h2>
      <p style={{ color: 'var(--muted)' }}>
        Membros operam recebimentos, estoque e retiradas desta instituição.
      </p>
      <ReadState result={members.result} refresh={members.refresh}>
        {(list: AdminMember[]) =>
          list.length === 0 ? (
            <p className="inst-message">
              Nenhum membro vinculado a esta instituição.
            </p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Vinculado em</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((member) => (
                    <tr key={member.userId}>
                      <td data-label="Nome">
                        <span className="admin-cell-main">
                          {member.displayName}
                        </span>
                      </td>
                      <td data-label="E-mail">{member.email}</td>
                      <td data-label="Vinculado em">
                        {dateTime.format(new Date(member.createdAt))}
                      </td>
                      <td data-label="Ações">
                        <ConfirmAction
                          label="Desvincular"
                          prompt={`Remover ${member.displayName} da equipe? A conta deixa de operar esta instituição.`}
                          confirmLabel="Desvincular membro"
                          danger
                          busy={busy === member.userId}
                          onConfirm={() =>
                            run(member.userId, () =>
                              revokeInstitutionMember(
                                institution.id,
                                member.userId,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </ReadState>
      <h3 className="admin-member-title">Vincular usuário</h3>
      <form
        className="admin-member-search"
        role="search"
        onSubmit={submit}
        aria-label="Buscar usuário para vincular"
      >
        <Field id="member-q" label="Buscar por nome ou e-mail">
          <input
            id="member-q"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </Field>
        <button className="button" type="submit">
          <Search size={14} aria-hidden="true" /> Buscar
        </button>
      </form>
      {search && (
        <ReadState result={candidates.result} refresh={candidates.refresh}>
          {(page) =>
            !page || page.items.length === 0 ? (
              <p className="inst-message">
                Nenhum usuário ativo encontrado para “{search}”.
              </p>
            ) : (
              <ul className="admin-candidates">
                {page.items.map((user: AdminUser) => {
                  const already = memberIds.has(user.id);
                  const self = currentUser?.id === user.id;
                  return (
                    <li key={user.id}>
                      <div className="inst-material">
                        <strong>{user.displayName}</strong>
                        <span className="admin-cell-sub">{user.email}</span>
                      </div>
                      {already ? (
                        <Pill tone="muted">Já é membro</Pill>
                      ) : (
                        <button
                          className="button"
                          type="button"
                          disabled={busy !== null || self}
                          title={
                            self
                              ? 'Use outro administrador para se vincular'
                              : undefined
                          }
                          onClick={() =>
                            run(user.id, () =>
                              assignInstitutionMember(institution.id, user.id),
                            )
                          }
                        >
                          {busy === user.id ? 'Vinculando…' : 'Vincular'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          }
        </ReadState>
      )}
      {error && (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function AdminInstitutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { result, refresh } = useRead(
    useCallback(
      (signal: AbortSignal) => findAdminInstitution(id ?? '', signal),
      [id],
    ),
  );
  useEffect(() => {
    document.title = 'Instituição | RePassa';
  }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      refresh();
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  if (result && 'data' in result && result.data === null)
    return <StatePanel kind="missing" />;

  return (
    <section className="frame admin-page" aria-labelledby="inst-det-titulo">
      <p style={{ marginBottom: 14 }}>
        <Link to="/admin/instituicoes">← Todas as instituições</Link>
      </p>
      <ReadState result={result} refresh={refresh}>
        {(institution) =>
          institution ? (
            <>
              <header className="admin-heading">
                <div>
                  <p className="eyebrow">Instituição</p>
                  <h1 id="inst-det-titulo">{institution.name}</h1>
                </div>
                {institutionPill(institution)}
              </header>
              <div className="admin-detail-grid">
                <dl>
                  <div>
                    <dt>Endereço público</dt>
                    <dd>{institution.publicAddress}</dd>
                  </div>
                  <div>
                    <dt>Membros</dt>
                    <dd>{institution.memberCount}</dd>
                  </div>
                  <div>
                    <dt>Materiais</dt>
                    <dd>{institution.materialCount}</dd>
                  </div>
                </dl>
                <dl>
                  <div>
                    <dt>Cadastro</dt>
                    <dd>
                      {dateTimeLong.format(new Date(institution.createdAt))}
                    </dd>
                  </div>
                  <div>
                    <dt>Atualização</dt>
                    <dd>
                      {dateTimeLong.format(new Date(institution.updatedAt))}
                    </dd>
                  </div>
                </dl>
              </div>
              <h2 className="admin-detail-label">Instruções de retirada</h2>
              <p className="inst-description">
                {institution.pickupInstructions}
              </p>
              <div className="admin-actions" style={{ marginTop: 22 }}>
                {institution.status === 'PENDING' && (
                  <PendingActions
                    institution={institution}
                    busy={busy}
                    onChange={run}
                  />
                )}
                {institution.status === 'APPROVED' &&
                  (institution.isActive ? (
                    <ConfirmAction
                      label="Suspender instituição"
                      prompt={`Suspender ${institution.name}? Ela deixa de aparecer como ponto de entrega.`}
                      confirmLabel="Suspender instituição"
                      danger
                      busy={busy}
                      onConfirm={() =>
                        run(() =>
                          setInstitutionActive(institution.id, false),
                        )
                      }
                    />
                  ) : (
                    <ConfirmAction
                      label="Reativar instituição"
                      prompt={`Reativar ${institution.name}? Ela volta a aparecer como ponto de entrega.`}
                      confirmLabel="Reativar instituição"
                      busy={busy}
                      onConfirm={() =>
                        run(() => setInstitutionActive(institution.id, true))
                      }
                    />
                  ))}
                {institution.status === 'REJECTED' && (
                  <p className="inst-description">
                    Cadastro recusado. Esta decisão não pode ser alterada pela
                    plataforma.
                  </p>
                )}
              </div>
              {error && (
                <p className="admin-inline-error" role="alert">
                  {error}
                </p>
              )}
              {institution.status === 'APPROVED' && (
                <MemberManager institution={institution} />
              )}
              {institution.status === 'PENDING' && (
                <p className="inst-message" style={{ marginTop: 28 }}>
                  Aprovação necessária antes de vincular membros da equipe.
                </p>
              )}
            </>
          ) : null
        }
      </ReadState>
    </section>
  );
}
