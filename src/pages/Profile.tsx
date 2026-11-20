import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowRight, LogOut } from 'lucide-react';
import { requestProfile, type AuthUser } from '../data/auth';
import type { AccountContext } from '../ui/PrivateArea';

export function ProfilePage() {
  const { signOut, leaving } = useOutletContext<AccountContext>();
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const life = useRef<AbortController | null>(null);
  useEffect(() => {
    document.title = 'Meu perfil | RePassa';
    const controller = new AbortController();
    life.current = controller;
    setError('');
    requestProfile(controller.signal)
      .then((value) => {
        setProfile(value);
        setName(value.displayName);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Não foi possível carregar os dados da conta.');
      });
    return () => controller.abort();
  }, [attempt]);
  async function save(event: FormEvent) {
    event.preventDefault();
    const controller = life.current;
    if (!controller || busy) return;
    setError('');
    setSaved(false);
    if (name.trim().length < 2) {
      setError('Informe um nome com pelo menos dois caracteres.');
      return;
    }
    setBusy(true);
    try {
      const value = await requestProfile(controller.signal, name.trim());
      setProfile(value);
      setName(value.displayName);
      setSaved(true);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof TypeError
            ? 'Falha de conexão. Tente salvar novamente.'
            : cause instanceof Error
              ? cause.message
              : 'Não foi possível salvar.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="frame account-page">
      <header className="account-heading">
        <p className="eyebrow">Minha conta</p>
        <h1>
          Meu <em>perfil</em>
        </h1>
      </header>
      {error && (
        <p className="account-feedback" role="alert">
          {error}
        </p>
      )}
      {!profile ? (
        error ? (
          <button className="button" onClick={() => setAttempt((n) => n + 1)}>
            Tentar novamente
          </button>
        ) : (
          <p role="status">Carregando perfil…</p>
        )
      ) : (
        <div className="profile-columns">
          <form className="profile-form" onSubmit={save}>
            <h2>Dados pessoais</h2>
            <label htmlFor="display-name">Nome de exibição</label>
            <input
              id="display-name"
              autoComplete="nickname"
              value={name}
              minLength={2}
              maxLength={80}
              required
              disabled={busy}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
                setError('');
              }}
            />
            <button
              className="button primary"
              disabled={busy || name.trim() === profile.displayName}
            >
              {busy ? 'Salvando…' : 'Salvar alterações'}{' '}
              <ArrowRight size={16} />
            </button>
            <p role="status">{saved && 'Nome atualizado.'}</p>
          </form>
          <aside className="profile-session">
            <h2>Acesso à conta</h2>
            <dl>
              <dt>E-mail</dt>
              <dd>{profile.email}</dd>
              <dt>Tipo de conta</dt>
              <dd>
                {
                  {
                    STUDENT: 'Estudante',
                    STAFF: 'Equipe da instituição',
                    ADMIN: 'Administração',
                  }[profile.role]
                }
              </dd>
            </dl>
            <button className="button" disabled={leaving} onClick={signOut}>
              <LogOut size={16} />
              Encerrar sessão
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
