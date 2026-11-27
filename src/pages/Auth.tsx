import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  Sparkles,
} from 'lucide-react';
import { AuthError } from '../data/auth.ts';
import { useAuthUser } from '../data/auth.ts';
import { isDemo } from '../data/catalog.ts';
import { login, register, safeReturnTo } from '../data/auth.ts';
import './auth.css';

function AuthArtwork({ registration = false }: { registration?: boolean }) {
  return (
    <aside
      className="auth-art"
      aria-label="Materiais escolares prontos para circular"
    >
      <div className="auth-art-copy">
        <span className="auth-kicker">
          <Sparkles size={14} /> REDE DE REUSO EDUCACIONAL
        </span>
        <p>
          {registration
            ? 'Toda jornada começa com algo compartilhado.'
            : 'Uma boa ideia sempre encontra outro caminho.'}
        </p>
      </div>
      <div className="auth-collage" aria-hidden="true">
        <div className="collage-paper collage-sheet">
          <span>
            caderno
            <br />
            de campo
          </span>
          <i>01 / 24</i>
        </div>
        <div className="collage-paper collage-book">
          <b>
            FÍSICA
            <br />
            EM MOVIMENTO
          </b>
          <small>volume I · ensino médio</small>
          <span className="book-orbit" />
        </div>
        <div className="collage-paper collage-note">
          <span>
            anotações
            <br />
            que continuam
          </span>
          <i>✳</i>
        </div>
        <div className="collage-ring" />
      </div>
      <div className="auth-art-foot">
        <Leaf size={16} /> Aprender também é fazer circular.
      </div>
    </aside>
  );
}

function feedback(error: unknown) {
  if (error instanceof AuthError) return error.message;
  return 'Não foi possível concluir. Tente novamente.';
}

function fieldMessage(errors: Record<string, string[]>, name: string) {
  return errors[name]?.[0];
}

function AuthFrame({
  children,
  registration,
}: {
  children: ReactNode;
  registration?: boolean;
}) {
  return (
    <div className="auth-page">
      <AuthArtwork registration={registration} />
      <section className="auth-panel">
        <div className="auth-form-wrap">{children}</div>
      </section>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthUser();
  const params = new URLSearchParams(location.search);
  const returnTo = safeReturnTo(
    params.get('returnTo') ??
      params.get('next') ??
      (params.get('intent') === 'doar' ? '/doar' : null),
    user?.role === 'ADMIN'
      ? '/admin'
      : user?.role === 'STAFF'
        ? '/instituicao'
        : '/catalogo',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  useEffect(() => {
    document.title = 'Entrar | RePassa';
  }, []);
  useEffect(() => {
    if (user) navigate(returnTo, { replace: true });
  }, [navigate, returnTo, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setError('');
    setFieldErrors({});
    setPending(true);
    try {
      await login({ email: email.trim(), password });
    } catch (cause) {
      setError(feedback(cause));
      if (cause instanceof AuthError) setFieldErrors(cause.fieldErrors ?? {});
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <span className="auth-kicker">ACESSO À CONTA</span>
      <h1>
        Entrar no
        <br />
        <em>RePassa.</em>
      </h1>
      <p className="auth-intro">
        Entre para encontrar materiais que ainda têm muito a ensinar.
      </p>
      {isDemo && (
        <div className="auth-demo" role="status">
          A demonstração usa dados fictícios. Entrar e criar conta estarão
          disponíveis quando a autenticação real for conectada.
        </div>
      )}
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="login-email">E-mail</label>
          <span className="auth-input">
            <Mail size={17} />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              disabled={isDemo}
              value={email}
              aria-invalid={Boolean(fieldMessage(fieldErrors, 'email'))}
              aria-describedby={
                fieldMessage(fieldErrors, 'email')
                  ? 'login-email-error'
                  : undefined
              }
              onChange={(event) => setEmail(event.target.value)}
            />
          </span>
          {fieldMessage(fieldErrors, 'email') && (
            <small id="login-email-error" className="auth-field-error">
              {fieldMessage(fieldErrors, 'email')}
            </small>
          )}
        </div>
        <div className="auth-field">
          <label htmlFor="login-password">Senha</label>
          <span className="auth-input">
            <LockKeyhole size={17} />
            <input
              id="login-password"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={128}
              required
              disabled={isDemo}
              value={password}
              aria-invalid={Boolean(fieldMessage(fieldErrors, 'password'))}
              aria-describedby={
                fieldMessage(fieldErrors, 'password')
                  ? 'login-password-error'
                  : undefined
              }
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              disabled={isDemo}
              onClick={() => setVisible(!visible)}
              aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
          {fieldMessage(fieldErrors, 'password') && (
            <small id="login-password-error" className="auth-field-error">
              {fieldMessage(fieldErrors, 'password')}
            </small>
          )}
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="auth-submit"
          type="submit"
          disabled={pending || isDemo}
        >
          {pending ? (
            'Entrando…'
          ) : (
            <>
              Entrar <ArrowUpRight size={18} />
            </>
          )}
        </button>
      </form>
      <p className="auth-switch">
        Ainda não tem uma conta?{' '}
        <Link to={`/cadastro${location.search}`}>
          Criar conta <ArrowUpRight size={14} />
        </Link>
      </p>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthUser();
  const params = new URLSearchParams(location.search);
  const returnTo = safeReturnTo(
    params.get('returnTo') ??
      params.get('next') ??
      (params.get('intent') === 'doar' ? '/doar' : null),
  );
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  useEffect(() => {
    document.title = 'Criar conta | RePassa';
  }, []);
  useEffect(() => {
    if (user) navigate(returnTo, { replace: true });
  }, [navigate, returnTo, user]);
  const passwordReady = password.length >= 12 && password.length <= 128;
  const confirmationReady = password === confirmation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    const confirmationField = event.currentTarget.elements.namedItem(
      'register-confirm',
    ) as HTMLInputElement | null;
    confirmationField?.setCustomValidity(
      confirmationReady ? '' : 'As senhas precisam ser iguais.',
    );
    if (!event.currentTarget.reportValidity()) return;
    if (!passwordReady || !confirmationReady || !consent) {
      setError('Confira a senha, a confirmação e o aviso de privacidade.');
      return;
    }
    setPending(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
    } catch (cause) {
      setError(feedback(cause));
      if (cause instanceof AuthError) setFieldErrors(cause.fieldErrors ?? {});
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame registration>
      <span className="auth-kicker">CONTA DE ESTUDANTE</span>
      <h1>
        Criar conta
        <br />
        de <em>estudante.</em>
      </h1>
      <p className="auth-intro">Descubra materiais que podem seguir adiante.</p>
      {isDemo && (
        <div className="auth-demo" role="status">
          A demonstração usa dados fictícios. O cadastro real estará disponível
          quando a autenticação for conectada.
        </div>
      )}
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="register-name">Nome de exibição</label>
          <span className="auth-input">
            <input
              id="register-name"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
              disabled={isDemo}
              value={displayName}
              aria-invalid={Boolean(fieldMessage(fieldErrors, 'displayName'))}
              aria-describedby={
                fieldMessage(fieldErrors, 'displayName')
                  ? 'register-name-error'
                  : undefined
              }
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </span>
          {fieldMessage(fieldErrors, 'displayName') && (
            <small id="register-name-error" className="auth-field-error">
              {fieldMessage(fieldErrors, 'displayName')}
            </small>
          )}
        </div>
        <div className="auth-field">
          <label htmlFor="register-email">E-mail</label>
          <span className="auth-input">
            <Mail size={17} />
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              disabled={isDemo}
              value={email}
              aria-invalid={Boolean(fieldMessage(fieldErrors, 'email'))}
              aria-describedby={
                fieldMessage(fieldErrors, 'email')
                  ? 'register-email-error'
                  : undefined
              }
              onChange={(event) => setEmail(event.target.value)}
            />
          </span>
          {fieldMessage(fieldErrors, 'email') && (
            <small id="register-email-error" className="auth-field-error">
              {fieldMessage(fieldErrors, 'email')}
            </small>
          )}
        </div>
        <div className="auth-field">
          <label htmlFor="register-password">Crie uma senha</label>
          <span className="auth-input">
            <LockKeyhole size={17} />
            <input
              id="register-password"
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              disabled={isDemo}
              value={password}
              aria-invalid={Boolean(fieldMessage(fieldErrors, 'password'))}
              aria-describedby={
                fieldMessage(fieldErrors, 'password')
                  ? 'register-password-error'
                  : 'password-requirement'
              }
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              disabled={isDemo}
              onClick={() => setVisible(!visible)}
              aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
          <small
            id="password-requirement"
            className={passwordReady ? 'requirement met' : 'requirement'}
          >
            Use entre 12 e 128 caracteres.
          </small>
          {fieldMessage(fieldErrors, 'password') && (
            <small id="register-password-error" className="auth-field-error">
              {fieldMessage(fieldErrors, 'password')}
            </small>
          )}
        </div>
        <div className="auth-field">
          <label htmlFor="register-confirm">Confirme sua senha</label>
          <span className="auth-input">
            <LockKeyhole size={17} />
            <input
              id="register-confirm"
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              required
              disabled={isDemo}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-invalid={confirmation.length > 0 && !confirmationReady}
              aria-describedby={confirmation.length > 0 && !confirmationReady ? 'confirmation-hint' : undefined}
            />
          </span>
        </div>
        {confirmation.length > 0 && !confirmationReady && (
          <small className="auth-field-error" id="confirmation-hint">As senhas precisam ser iguais.</small>
        )}
        <div className="auth-permission">
          <p id="consent-notice" className="auth-consent-notice">
            Aviso de privacidade: nome e e-mail serão usados para criar e
            identificar sua conta de estudante no RePassa.
          </p>
          <label className="auth-consent">
            <input
              type="checkbox"
              aria-describedby="consent-notice"
              required
              disabled={isDemo}
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>Concordo com esse uso dos meus dados.</span>
          </label>
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="auth-submit"
          type="submit"
          disabled={pending || isDemo}
        >
          {pending ? (
            'Criando conta…'
          ) : (
            <>
              Criar conta de estudante <ArrowUpRight size={18} />
            </>
          )}
        </button>
      </form>
      <p className="auth-switch">
        Já tem uma conta?{' '}
        <Link to={`/entrar${location.search}`}>
          Entrar <ArrowUpRight size={14} />
        </Link>
      </p>
    </AuthFrame>
  );
}
