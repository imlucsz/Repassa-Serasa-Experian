import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import {
  institutionStatusLabels,
  listAdminAuditEvents,
  listAdminInstitutions,
  listAdminMaterials,
  listAdminReservations,
  listAdminUsers,
  type AdminAuditEvent,
  type AdminInstitution,
} from '../data/admin';
import { ReadState, useRead } from './adminShared';
import './admin.css';

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function actionLabel(action: string) {
  const labels: Record<string, string> = {
    'admin.institution_approve': 'Instituição aprovada',
    'admin.institution_reject': 'Instituição recusada',
    'admin.institution_activate': 'Instituição reativada',
    'admin.institution_deactivate': 'Instituição suspensa',
    'admin.membership_assign': 'Membro vinculado',
    'admin.membership_revoke': 'Membro desvinculado',
    'admin.user_role': 'Função alterada',
    'admin.user_activate': 'Usuário reativado',
    'admin.user_deactivate': 'Usuário desativado',
    'institution.register': 'Cadastro institucional',
  };
  return labels[action] ?? action;
}

interface DashboardData {
  pending: { items: AdminInstitution[]; total: number };
  activeInstitutions: number;
  students: number;
  materials: number;
  delivered: number;
  events: AdminAuditEvent[];
}

export function AdminDashboardPage() {
  const { result, refresh } = useRead(
    useCallback(async (signal: AbortSignal): Promise<DashboardData> => {
      const [pending, active, students, materials, delivered, events] =
        await Promise.all([
          listAdminInstitutions({ status: 'PENDING', pageSize: 5 }, signal),
          listAdminInstitutions(
            { status: 'APPROVED', isActive: true, pageSize: 1 },
            signal,
          ),
          listAdminUsers({ role: 'STUDENT', pageSize: 1 }, signal),
          listAdminMaterials({ status: 'AVAILABLE', pageSize: 1 }, signal),
          listAdminReservations({ status: 'COMPLETED', pageSize: 1 }, signal),
          listAdminAuditEvents({ pageSize: 8 }, signal),
        ]);
      return {
        pending,
        activeInstitutions: active.total,
        students: students.total,
        materials: materials.total,
        delivered: delivered.total,
        events: events.items,
      };
    }, []),
  );
  useEffect(() => {
    document.title = 'Administração | RePassa';
  }, []);

  return (
    <section className="frame" aria-labelledby="admin-titulo">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 id="admin-titulo">Visão geral</h1>
        </div>
        <Link className="button" to="/instituicoes/nova">
          Cadastrar instituição <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>
      <ReadState result={result} refresh={refresh}>
        {(data) => (
          <>
            <dl className="admin-metrics">
              <div data-tone={data.pending.total > 0 ? 'warn' : undefined}>
                <dt>Aprovações pendentes</dt>
                <dd>{data.pending.total}</dd>
              </div>
              <div>
                <dt>Instituições ativas</dt>
                <dd>{data.activeInstitutions}</dd>
              </div>
              <div>
                <dt>Estudantes</dt>
                <dd>{data.students}</dd>
              </div>
              <div>
                <dt>Materiais disponíveis</dt>
                <dd>{data.materials}</dd>
              </div>
              <div>
                <dt>Retiradas concluídas</dt>
                <dd>{data.delivered}</dd>
              </div>
            </dl>
            {data.pending.total > 0 && (
              <div className="inst-notice">
                <p>
                  <strong>
                    {data.pending.total === 1
                      ? 'Uma instituição aguarda análise'
                      : `${data.pending.total} instituições aguardam análise`}
                    .
                  </strong>{' '}
                  {data.pending.items.map((item) => item.name).join(', ')}
                  {data.pending.total > data.pending.items.length ? '…' : '.'}
                </p>
                <p style={{ marginTop: 10 }}>
                  <Link to="/admin/instituicoes?status=PENDING">
                    Revisar cadastros pendentes
                  </Link>
                </p>
              </div>
            )}
            <section className="admin-section" aria-labelledby="admin-atividade">
              <h2 id="admin-atividade">Atividade recente</h2>
              {data.events.length === 0 ? (
                <p className="inst-message">
                  Nenhum evento administrativo registrado ainda.
                </p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Evento</th>
                        <th scope="col">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map((event) => (
                        <tr key={event.id}>
                          <td data-label="Evento">
                            <span className="admin-cell-main">
                              {actionLabel(event.action)}
                            </span>
                            <span className="admin-cell-sub">
                              {event.action}
                            </span>
                          </td>
                          <td data-label="Data">
                            {dateTime.format(new Date(event.createdAt))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ marginTop: 18 }}>
                <Link to="/admin/auditoria">
                  Ver histórico completo de auditoria
                </Link>
              </p>
            </section>
          </>
        )}
      </ReadState>
    </section>
  );
}
