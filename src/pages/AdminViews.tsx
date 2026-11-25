import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  listAdminAuditEvents,
  listAllAdminInstitutions,
  listAdminMaterials,
  listAdminReservations,
  reservationStatusLabels,
  type AdminInstitution,
} from '../data/admin';
import { statusLabels, type MaterialStatus } from '../data/operations';
import { categoryLabels, conditionLabels } from '../data/contract';
import { Field } from '../ui/Field';
import { actionLabel } from './Admin';
import {
  Pager,
  Pill,
  EmptyResults,
  ReadState,
  useRead,
} from './adminShared';
import './admin.css';

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const PAGE_SIZE = 15;

function useInstitutionOptions() {
  const { result } = useRead(
    useCallback(
      (signal: AbortSignal) =>
        listAllAdminInstitutions(signal),
      [],
    ),
  );
  return useMemo(
    () => (result && 'data' in result ? result.data : []),
    [result],
  );
}

function materialTone(status: MaterialStatus) {
  switch (status) {
    case 'AVAILABLE':
      return 'ok' as const;
    case 'RESERVED':
    case 'PENDING_RECEIPT':
      return 'warn' as const;
    case 'REJECTED':
    case 'CANCELED':
      return 'danger' as const;
    default:
      return 'muted' as const;
  }
}

function reservationTone(status: keyof typeof reservationStatusLabels) {
  switch (status) {
    case 'ACTIVE':
      return 'ok' as const;
    case 'EXPIRED':
      return 'warn' as const;
    case 'CANCELED':
      return 'danger' as const;
    default:
      return 'muted' as const;
  }
}

export function AdminMaterialsPage() {
  const institutions = useInstitutionOptions();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const institutionId = params.get('instituicao') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const { result, refresh } = useRead(
    useCallback(
      (signal: AbortSignal) =>
        listAdminMaterials(
          {
            page,
            pageSize: PAGE_SIZE,
            status: (status || undefined) as MaterialStatus | undefined,
            institutionId: institutionId || undefined,
          },
          signal,
        ),
      [page, status, institutionId],
    ),
  );
  useEffect(() => {
    document.title = 'Materiais | RePassa';
  }, []);

  function update(next: Record<string, string>) {
    const merged = { status, instituicao: institutionId, ...next };
    const entries = Object.entries(merged).filter(([, value]) => value);
    setParams(new URLSearchParams(entries), { replace: true });
  }

  return (
    <section className="frame admin-page" aria-labelledby="mat-titulo">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 id="mat-titulo">Materiais</h1>
        </div>
        <p>
          Consulta de todo o acervo declarado nas instituições, em qualquer
          situação. A gestão do estoque é feita pela equipe de cada ponto.
        </p>
      </header>
      <div className="admin-filters">
        <Field id="mat-status" label="Situação">
          <select
            id="mat-status"
            value={status}
            onChange={(event) =>
              update({ status: event.target.value, page: '' })
            }
          >
            <option value="">Todas</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="mat-inst" label="Instituição">
          <select
            id="mat-inst"
            value={institutionId}
            onChange={(event) =>
              update({ instituicao: event.target.value, page: '' })
            }
          >
            <option value="">Todas</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ReadState result={result} refresh={refresh}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyResults>
              Nenhum material encontrado com estes filtros.
            </EmptyResults>
          ) : (
            <>
              <p className="inst-total">
                {data.total}{' '}
                {data.total === 1
                  ? 'material encontrado'
                  : 'materiais encontrados'}
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Material</th>
                      <th scope="col">Categoria</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Instituição</th>
                      <th scope="col">Cadastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((material) => (
                      <tr key={material.id}>
                        <td data-label="Material">
                          <span className="admin-cell-main">
                            {material.title}
                          </span>
                          <span className="admin-cell-sub">
                            {conditionLabels[material.condition]}
                          </span>
                        </td>
                        <td data-label="Categoria">{categoryLabels[material.category]}</td>
                        <td data-label="Situação">
                          <Pill tone={materialTone(material.status)}>
                            {statusLabels[material.status]}
                          </Pill>
                        </td>
                        <td data-label="Instituição">
                          {material.institution.name}
                        </td>
                        <td data-label="Cadastro">
                          {dateTime.format(new Date(material.createdAt))}
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
                busy={!result}
                onPage={(next) => update({ page: String(next) })}
              />
            </>
          )
        }
      </ReadState>
    </section>
  );
}

export function AdminReservationsPage() {
  const institutions = useInstitutionOptions();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const institutionId = params.get('instituicao') ?? '';
  const studentId = params.get('estudante') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(studentId);

  const { result, refresh } = useRead(
    useCallback(
      (signal: AbortSignal) =>
        listAdminReservations(
          {
            page,
            pageSize: PAGE_SIZE,
            status: (status || undefined) as
              | keyof typeof reservationStatusLabels
              | undefined,
            institutionId: institutionId || undefined,
            studentId: studentId || undefined,
          },
          signal,
        ),
      [page, status, institutionId, studentId],
    ),
  );
  useEffect(() => {
    document.title = 'Reservas | RePassa';
  }, []);

  function update(next: Record<string, string>) {
    const merged = {
      status,
      instituicao: institutionId,
      estudante: studentId,
      ...next,
    };
    const entries = Object.entries(merged).filter(([, value]) => value);
    setParams(new URLSearchParams(entries), { replace: true });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ estudante: draft.trim(), page: '' });
  }

  return (
    <section className="frame admin-page" aria-labelledby="res-titulo">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 id="res-titulo">Reservas</h1>
        </div>
        <p>
          Acompanhamento das reservas em todas as instituições. Os códigos de
          retirada nunca são exibidos nesta consulta.
        </p>
      </header>
      <form className="admin-filters" role="search" onSubmit={search}>
        <Field id="res-status" label="Situação">
          <select
            id="res-status"
            value={status}
            onChange={(event) =>
              update({ status: event.target.value, page: '' })
            }
          >
            <option value="">Todas</option>
            {Object.entries(reservationStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="res-inst" label="Instituição">
          <select
            id="res-inst"
            value={institutionId}
            onChange={(event) =>
              update({ instituicao: event.target.value, page: '' })
            }
          >
            <option value="">Todas</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="res-student" label="ID do estudante (opcional)">
          <input
            id="res-student"
            type="search"
            value={draft}
            placeholder="UUID do estudante"
            onChange={(event) => setDraft(event.target.value)}
          />
        </Field>
        <button className="button" type="submit">
          <Search size={14} aria-hidden="true" /> Filtrar
        </button>
      </form>
      <ReadState result={result} refresh={refresh}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyResults clearDraft={() => setDraft('')}>
              Nenhuma reserva encontrada com estes filtros.
            </EmptyResults>
          ) : (
            <>
              <p className="inst-total">
                {data.total}{' '}
                {data.total === 1
                  ? 'reserva encontrada'
                  : 'reservas encontradas'}
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Material</th>
                      <th scope="col">Instituição</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Reservada em</th>
                      <th scope="col">Prazo</th>
                      <th scope="col">Retirada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((reservation) => (
                      <tr key={reservation.id}>
                        <td data-label="Material">
                          <span className="admin-cell-main">
                            {reservation.material.title}
                          </span>
                          <span className="admin-cell-sub">
                            Estudante {reservation.studentId.slice(0, 8)}…
                          </span>
                        </td>
                        <td data-label="Instituição">
                          {reservation.material.institution.name}
                        </td>
                        <td data-label="Situação">
                          <Pill tone={reservationTone(reservation.status)}>
                            {reservationStatusLabels[reservation.status]}
                          </Pill>
                        </td>
                        <td data-label="Reservada em">
                          {dateTime.format(new Date(reservation.createdAt))}
                        </td>
                        <td data-label="Prazo">
                          {dateTime.format(new Date(reservation.expiresAt))}
                        </td>
                        <td data-label="Retirada">
                          {reservation.completedAt
                            ? dateTime.format(
                                new Date(reservation.completedAt),
                              )
                            : '—'}
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
                busy={!result}
                onPage={(next) => update({ page: String(next) })}
              />
            </>
          )
        }
      </ReadState>
    </section>
  );
}

const knownActions = [
  'admin.',
  'admin.institution_approve',
  'admin.institution_reject',
  'admin.institution_activate',
  'admin.institution_deactivate',
  'admin.membership_assign',
  'admin.membership_revoke',
  'admin.user_role',
  'admin.user_activate',
  'admin.user_deactivate',
  'institution.register',
];

export function AdminAuditPage() {
  const [params, setParams] = useSearchParams();
  const action = params.get('acao') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(action);

  const { result, refresh } = useRead(
    useCallback(
      (signal: AbortSignal) =>
        listAdminAuditEvents(
          { page, pageSize: PAGE_SIZE, action: action || undefined },
          signal,
        ),
      [page, action],
    ),
  );
  useEffect(() => {
    document.title = 'Auditoria | RePassa';
  }, []);

  function update(next: Record<string, string>) {
    const merged = { acao: action, ...next };
    const entries = Object.entries(merged).filter(([, value]) => value);
    setParams(new URLSearchParams(entries), { replace: true });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ acao: draft.trim(), page: '' });
  }
  function contextOf(event: {
    institutionId: string | null;
    materialId: string | null;
    reservationId: string | null;
  }) {
    const parts: string[] = [];
    if (event.institutionId)
      parts.push('instituição ' + event.institutionId.slice(0, 8));
    if (event.materialId)
      parts.push('material ' + event.materialId.slice(0, 8));
    if (event.reservationId)
      parts.push('reserva ' + event.reservationId.slice(0, 8));
    return parts.join(' · ') || '—';
  }

  return (
    <section className="frame admin-page" aria-labelledby="aud-titulo">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 id="aud-titulo">Histórico de auditoria</h1>
        </div>
        <p>
          Trilha das ações administrativas e registros sensíveis. Use o nome
          exato da ação ou um prefixo terminado em ponto, como
          “admin.”.
        </p>
      </header>
      <form className="admin-filters" role="search" onSubmit={search}>
        <Field id="aud-action" label="Filtrar por ação">
          <input
            id="aud-action"
            type="search"
            list="aud-acoes"
            value={draft}
            placeholder="admin.institution_approve"
            onChange={(event) => setDraft(event.target.value)}
          />
        </Field>
        <datalist id="aud-acoes">
          {knownActions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <button className="button" type="submit">
          <Search size={14} aria-hidden="true" /> Filtrar
        </button>
      </form>
      <ReadState result={result} refresh={refresh}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyResults clearDraft={() => setDraft('')}>
              Nenhum evento encontrado com este filtro.
            </EmptyResults>
          ) : (
            <>
              <p className="inst-total">
                {data.total}{' '}
                {data.total === 1
                  ? 'evento encontrado'
                  : 'eventos encontrados'}
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Evento</th>
                      <th scope="col">Autor</th>
                      <th scope="col">Contexto</th>
                      <th scope="col">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((event) => (
                      <tr key={event.id}>
                        <td data-label="Evento">
                          <span className="admin-cell-main">
                            {actionLabel(event.action)}
                          </span>
                          <span className="admin-cell-sub">{event.action}</span>
                        </td>
                        <td data-label="Autor">
                          {event.actorId ? (
                            <span title={event.actorId}>
                              {event.actorId.slice(0, 8)}…
                            </span>
                          ) : (
                            'Sistema'
                          )}
                        </td>
                        <td data-label="Contexto">{contextOf(event)}</td>
                        <td data-label="Data">
                          {dateTime.format(new Date(event.createdAt))}
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
                busy={!result}
                onPage={(next) => update({ page: String(next) })}
              />
            </>
          )
        }
      </ReadState>
    </section>
  );
}
