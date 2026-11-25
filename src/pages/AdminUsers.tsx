import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  listAdminUsers,
  roleLabels,
  setUserActive,
  setUserRole,
  type AdminUser,
} from '../data/admin';
import { useAuthUser } from '../data/auth';
import { Field } from '../ui/Field';
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
const PAGE_SIZE = 10;

function UserActions({
  user,
  self,
  busy,
  onChange,
}: {
  user: AdminUser;
  self: boolean;
  busy: boolean;
  onChange: (action: () => Promise<unknown>) => void;
}) {
  if (user.role === 'ADMIN')
    return <span className="admin-cell-sub">Gerida fora da plataforma</span>;
  if (self)
    return (
      <span className="admin-cell-sub">
        Sua própria conta — peça a outro administrador
      </span>
    );
  return (
    <div className="admin-actions">
      {user.role === 'STUDENT' ? (
        <ConfirmAction
          label="Tornar equipe"
          prompt={`Tornar ${user.displayName} membro de equipe? Depois vincule a conta a uma instituição.`}
          confirmLabel="Tornar equipe"
          busy={busy}
          onConfirm={() => onChange(() => setUserRole(user.id, 'STAFF'))}
        />
      ) : (
        <ConfirmAction
          label="Tornar estudante"
          prompt={`Tornar ${user.displayName} estudante? Os vínculos com instituições são removidos.`}
          confirmLabel="Tornar estudante"
          danger
          busy={busy}
          onConfirm={() => onChange(() => setUserRole(user.id, 'STUDENT'))}
        />
      )}
      {user.isActive ? (
        <ConfirmAction
          label="Desativar"
          prompt={`Desativar ${user.displayName}? As sessões desta conta são encerradas.`}
          confirmLabel="Desativar conta"
          danger
          busy={busy}
          onConfirm={() => onChange(() => setUserActive(user.id, false))}
        />
      ) : (
        <ConfirmAction
          label="Reativar"
          prompt={`Reativar ${user.displayName}? A conta volta a poder entrar.`}
          confirmLabel="Reativar conta"
          busy={busy}
          onConfirm={() => onChange(() => setUserActive(user.id, true))}
        />
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const currentUser = useAuthUser();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') ?? '';
  const isActive = params.get('isActive') ?? '';
  const query = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(query);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { result, refresh } = useRead(
    useCallback(
      (signal: AbortSignal) =>
        listAdminUsers(
          {
            page,
            pageSize: PAGE_SIZE,
            role: (role || undefined) as
              | 'STUDENT'
              | 'STAFF'
              | 'ADMIN'
              | undefined,
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
      [page, role, isActive, query],
    ),
  );
  useEffect(() => {
    document.title = 'Usuários | RePassa';
  }, []);

  function update(next: Record<string, string>) {
    const merged = { role, isActive, q: query, ...next };
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
    <section className="frame admin-page" aria-labelledby="users-titulo">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 id="users-titulo">Usuários e permissões</h1>
        </div>
        <p>
          Perfis de administração são geridos fora da plataforma. Aqui você
          alterna contas entre estudante e equipe e controla o acesso.
        </p>
      </header>
      <form className="admin-filters" role="search" onSubmit={search}>
        <Field id="user-q" label="Buscar por nome ou e-mail">
          <input
            id="user-q"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </Field>
        <Field id="user-role" label="Função">
          <select
            id="user-role"
            value={role}
            onChange={(event) => update({ role: event.target.value, page: '' })}
          >
            <option value="">Todas</option>
            <option value="STUDENT">Estudante</option>
            <option value="STAFF">Equipe</option>
            <option value="ADMIN">Administração</option>
          </select>
        </Field>
        <Field id="user-ativo" label="Acesso">
          <select
            id="user-ativo"
            value={isActive}
            onChange={(event) =>
              update({ isActive: event.target.value, page: '' })
            }
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Desativados</option>
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
              Nenhum usuário encontrado com estes filtros.
            </EmptyResults>
          ) : (
            <>
              <p className="inst-total">
                {data.total}{' '}
                {data.total === 1
                  ? 'usuário encontrado'
                  : 'usuários encontrados'}
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Usuário</th>
                      <th scope="col">Função</th>
                      <th scope="col">Vínculos</th>
                      <th scope="col">Acesso</th>
                      <th scope="col">Criado em</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((user) => (
                      <tr key={user.id}>
                        <td data-label="Usuário">
                          <span className="admin-cell-main">
                            {user.displayName}
                          </span>
                          <span className="admin-cell-sub">{user.email}</span>
                        </td>
                        <td data-label="Função">{roleLabels[user.role]}</td>
                        <td data-label="Vínculos">{user.membershipCount}</td>
                        <td data-label="Acesso">
                          <Pill tone={user.isActive ? 'ok' : 'danger'}>
                            {user.isActive ? 'Ativo' : 'Desativado'}
                          </Pill>
                        </td>
                        <td data-label="Criado em">
                          {dateTime.format(new Date(user.createdAt))}
                        </td>
                        <td data-label="Ações">
                          <UserActions
                            user={user}
                            self={currentUser?.id === user.id}
                            busy={busy}
                            onChange={run}
                          />
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
