import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  ImagePlus,
  MapPin,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  categoryLabels,
  conditionLabels,
  listInstitutions,
} from '../data/catalog';
import type { Category, Condition, Institution, Page } from '../data/contract';
import {
  cancelDonation,
  createDonation,
  listDonations,
  OperationError,
  statusLabels,
  upload,
  type ManagedMaterial,
} from '../data/operations';
import { Field } from '../ui/Field';
import { EmptyHistory } from '../components/EmptyHistory';
import './donations.css';

const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
});

function failureMessage(error: unknown, fallback: string) {
  return error instanceof OperationError ? error.message : fallback;
}

function DeliveryPoint({ institution }: { institution: Institution }) {
  return (
    <div className="donation-point">
      <MapPin size={18} aria-hidden="true" />
      <div>
        <strong>{institution.name}</strong>
        <p>{institution.publicAddress}</p>
      </div>
    </div>
  );
}

function PhotoInput({
  file,
  error,
  onChange,
}: {
  file: File | null;
  error: string;
  onChange: (file: File | null, error: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Field id="donation-photo" label="Foto do material (opcional)">
      <span className="donation-hint" id="donation-photo-hint">
        JPEG, PNG ou WebP de até 5 MiB.
      </span>
      <div className="donation-photo">
        {file && preview ? (
          <img src={preview} alt="Prévia da foto selecionada" />
        ) : (
          <ImagePlus aria-hidden="true" size={26} />
        )}
        <span className="donation-photo-label" aria-hidden="true">
          {file ? 'Trocar foto' : 'Escolher foto'}
          {file && <small>{file.name}</small>}
        </span>
        <input
          ref={input}
          id="donation-photo"
          type="file"
          accept={photoTypes.join(',')}
          aria-invalid={Boolean(error)}
          aria-describedby={
            'donation-photo-hint' + (error ? ' donation-photo-error' : '')
          }
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            const invalid =
              selected &&
              (!photoTypes.includes(selected.type) ||
                selected.size > 5 * 1024 * 1024 ||
                selected.size === 0);
            if (invalid) {
              event.target.value = '';
              onChange(
                null,
                'Escolha uma foto JPEG, PNG ou WebP de até 5 MiB que não esteja vazia.',
              );
            } else onChange(selected, '');
          }}
        />
      </div>
      {(file || error) && (
        <button
          className="donation-text-button"
          type="button"
          onClick={() => {
            if (input.current) {
              input.current.value = '';
              input.current.focus();
            }
            onChange(null, '');
          }}
        >
          {file ? 'Remover foto' : 'Continuar sem foto'}
        </button>
      )}
      {error && (
        <small
          className="donation-error"
          id="donation-photo-error"
          role="alert"
        >
          {error}
        </small>
      )}
    </Field>
  );
}

function DonationReceipt({ donation }: { donation: ManagedMaterial }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="donation-receipt">
      <div className="receipt-masthead">
        <p className="eyebrow">Doação cadastrada</p>
        <span className="donation-seal">
          <Check aria-hidden="true" size={32} />
        </span>
      </div>
      <h1 ref={heading} tabIndex={-1}>
        Agora é hora da <em>entrega.</em>
      </h1>
      <span className="donation-status" data-status={donation.status}>
        <Clock3 size={15} />
        {statusLabels[donation.status]}
      </span>
      <dl className="receipt-material">
        <dt>Material cadastrado</dt>
        <dd>{donation.title}</dd>
      </dl>
      <p>Leve o material ao ponto de entrega abaixo. Ele só poderá entrar no acervo após a conferência e a aprovação da equipe.</p>
      <DeliveryPoint institution={donation.institution} />
      <Link className="button primary" to="/minhas-doacoes">
        Ver minhas doações <ArrowRight size={16} />
      </Link>
    </section>
  );
}

export function DonatePage() {
  const [institutions, setInstitutions] = useState<Institution[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [institutionId, setInstitutionId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<'idle' | 'upload' | 'save'>('idle');
  const [uncertain, setUncertain] = useState(false);
  const [receipt, setReceipt] = useState<ManagedMaterial | null>(null);
  const uploadId = useRef<string | undefined>(undefined);
  const mutation = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = 'Doar material · RePassa';
    const request = new AbortController();
    setLoadError(false);
    listInstitutions(request.signal)
      .then((data) => {
        if (!request.signal.aborted) setInstitutions(data);
      })
      .catch(() => {
        if (!request.signal.aborted) setLoadError(true);
      });
    return () => request.abort();
  }, [reload]);
  useEffect(() => () => mutation.current?.abort(), []);

  const point = institutions?.find((item) => item.id === institutionId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!point || uncertain || mutation.current) return;
    if (photoError) {
      document.getElementById('donation-photo')?.focus();
      return;
    }
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    if (title.length < 3 || description.length < 10) {
      setMessage(
        title.length < 3
          ? 'Informe um título com pelo menos 3 caracteres.'
          : 'Descreva o material em pelo menos 10 caracteres.',
      );
      const control = event.currentTarget.elements.namedItem(
        title.length < 3 ? 'title' : 'description',
      );
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    const request = new AbortController();
    mutation.current = request;
    let saving = false;
    setMessage('');
    try {
      if (file && !uploadId.current) {
        setPhase('upload');
        uploadId.current = await upload(file, request.signal);
      }
      request.signal.throwIfAborted();
      setPhase('save');
      saving = true;
      const result = await createDonation(
        {
          title,
          description,
          category: data.get('category') as Category,
          condition: data.get('condition') as Condition,
          institutionId: point.id,
          uploadId: uploadId.current,
        },
        request.signal,
      );
      if (!request.signal.aborted) setReceipt(result);
    } catch (error) {
      if (request.signal.aborted) return;
      if (
        saving &&
        (!(error instanceof OperationError) ||
          error.status === 0 ||
          error.status >= 500)
      ) {
        setUncertain(true);
        setMessage(
          'Não foi possível confirmar o cadastro. Confira suas doações antes de tentar novamente.',
        );
      } else {
        if (error instanceof OperationError && error.fieldErrors?.uploadId)
          uploadId.current = undefined;
        if (error instanceof OperationError && error.fieldErrors?.institutionId)
          setReload((value) => value + 1);
        const fieldHint =
          error instanceof OperationError
            ? Object.values(error.fieldErrors ?? {})
                .flat()
                .join(' ')
            : '';
        setMessage(
          fieldHint ||
            failureMessage(
              error,
              saving
                ? 'Não foi possível cadastrar o material. Tente novamente.'
                : 'Não foi possível enviar a foto. Tente novamente.',
            ),
        );
      }
    } finally {
      mutation.current = null;
      if (!request.signal.aborted) setPhase('idle');
    }
  }

  return (
    <div className="frame donation-page">
      {receipt ? (
        <DonationReceipt donation={receipt} />
      ) : (
        <>
          <header className="donation-heading">
            <p className="eyebrow">
              <span className="ink-rule" /> Área do estudante
            </p>
            <h1>
              Doar um <em>material.</em>
            </h1>
            <p>Cadastre um item por vez e escolha onde fazer a entrega.</p>
          </header>
          <div className="donation-layout">
            <form className="donation-form" onSubmit={submit}>
              <fieldset disabled={phase !== 'idle'}>
                <legend>Sobre o material</legend>
                <Field id="donation-title" label="Título do material">
                  <input
                    name="title"
                    id="donation-title"
                    required
                    minLength={3}
                    maxLength={120}
                    placeholder="Ex. Atlas de geografia"
                  />
                </Field>
                <Field id="donation-description" label="Descrição">
                  <textarea
                    name="description"
                    id="donation-description"
                    rows={3}
                    minLength={10}
                    maxLength={1000}
                    required
                    placeholder="Conte o que acompanha o material e se há marcas de uso."
                  />
                </Field>
                <div className="donation-pair">
                  <Field id="donation-category" label="Categoria">
                    <select
                      name="category"
                      id="donation-category"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Selecione a categoria
                      </option>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="donation-condition" label="Condição">
                    <select
                      name="condition"
                      id="donation-condition"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Selecione a condição
                      </option>
                      {Object.entries(conditionLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <PhotoInput
                  file={file}
                  error={photoError}
                  onChange={(next, error) => {
                    uploadId.current = undefined;
                    setFile(next);
                    setPhotoError(error);
                  }}
                />
              </fieldset>
              <fieldset disabled={phase !== 'idle'}>
                <legend>Ponto de entrega</legend>
                {loadError ? (
                  <div role="alert" className="donation-notice">
                    <p>Não foi possível carregar as instituições.</p>
                    <button
                      type="button"
                      className="donation-text-button"
                      onClick={() => setReload((value) => value + 1)}
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : institutions === null ? (
                  <p role="status">Carregando instituições…</p>
                ) : !institutions.length ? (
                  <p role="status">
                    Ainda não há instituições disponíveis para receber doações.
                  </p>
                ) : (
                  <Field id="donation-institution" label="Instituição">
                    <select
                      id="donation-institution"
                      required
                      value={institutionId}
                      onChange={(event) => setInstitutionId(event.target.value)}
                    >
                      <option value="" disabled>
                        Selecione o ponto de entrega
                      </option>
                      {institutions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {point && <DeliveryPoint institution={point} />}
              </fieldset>
              {message && (
                <div role="alert" className="donation-notice">
                  {message}
                  {uncertain && (
                    <p>
                      <Link
                        className="donation-text-button"
                        to="/minhas-doacoes"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Conferir histórico em outra aba
                      </Link>
                      {' · '}
                      <button
                        type="button"
                        className="donation-text-button"
                        onClick={() => {
                          setUncertain(false);
                          setMessage('');
                        }}
                      >
                        Já conferi o histórico
                      </button>
                    </p>
                  )}
                </div>
              )}
              <button
                className="button primary"
                type="submit"
                disabled={!point || phase !== 'idle' || uncertain}
              >
                {phase === 'upload'
                  ? 'Enviando foto…'
                  : phase === 'save'
                    ? 'Cadastrando…'
                    : 'Cadastrar doação'}{' '}
                <ArrowRight size={17} />
              </button>
            </form>
            <aside className="donation-aside">
              <BookOpen size={32} strokeWidth={1.4} aria-hidden="true" />
              <h2>Depois do cadastro</h2>
              <p>
                Entregue o material na instituição escolhida. Assim que a equipe
                confirmar o recebimento, outro estudante poderá reservá-lo.
              </p>
              <Link to="/minhas-doacoes">
                Acompanhar minhas doações <ArrowUpRight size={16} />
              </Link>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

export function DonationsPage() {
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Page<ManagedMaterial> | null>(null);
  const [listError, setListError] = useState('');
  const [reload, setReload] = useState(0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const mutation = useRef<AbortController | null>(null);

  const keep = useRef<HTMLButtonElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = 'Minhas doações · RePassa';
    const request = new AbortController();
    setList(null);
    setListError('');
    setConfirm(null);
    listDonations(page, 10, request.signal)
      .then((result) => {
        if (request.signal.aborted) return;
        if (result.items.length === 0 && page > 1) setPage(1);
        else setList(result);
      })
      .catch((error) => {
        if (!request.signal.aborted)
          setListError(
            failureMessage(error, 'Não foi possível carregar suas doações.'),
          );
      });
    return () => request.abort();
  }, [page, reload]);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    if (confirm) keep.current?.focus();
  }, [confirm]);

  async function cancel(id: string) {
    if (mutation.current || id !== confirm) return;
    const request = new AbortController();
    mutation.current = request;
    setBusy(true);
    setNotice('');
    try {
      const result = await cancelDonation(id, request.signal);
      if (request.signal.aborted) return;
      setList(
        (previous) =>
          previous && {
            ...previous,
            items: previous.items.map((item) =>
              item.id === result.id ? result : item,
            ),
          },
      );
      setNotice('Doação cancelada.');
    } catch (error) {
      if (request.signal.aborted) return;
      setNotice(
        failureMessage(
          error,
          'Não foi possível confirmar o cancelamento. Consulte a situação atual do material.',
        ),
      );
      setReload((value) => value + 1);
    } finally {
      mutation.current = null;
      if (!request.signal.aborted) {
        setBusy(false);
        setConfirm(null);
        listHeading.current?.focus({ preventScroll: true });
      }
    }
  }

  return (
    <div className="frame donation-page">
      <header className="donation-heading donation-history-heading">
        <div>
          <p className="eyebrow">
            <span className="ink-rule" /> Área do estudante
          </p>
          <h1 ref={listHeading} tabIndex={-1}>
            Minhas <em>doações.</em>
          </h1>
          <p>Acompanhe a entrega e o destino dos seus materiais.</p>
        </div>
        {Boolean(list?.items.length) && (
          <Link className="button primary" to="/doar">
            <Plus size={17} /> Doar um material
          </Link>
        )}
      </header>
      {notice && (
        <p className="donation-notice" role="status">
          {notice}
        </p>
      )}
      {listError ? (
        <div className="donation-empty" role="alert">
          <p>{listError}</p>
          <button
            className="button"
            onClick={() => setReload((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : list === null ? (
        <p className="donation-empty" role="status">
          Carregando suas doações…
        </p>
      ) : list.items.length === 0 ? (
        <EmptyHistory kind="donation" />
      ) : (
        <>
          <ul className="donation-history donation-ledger">
            {list.items.map((item) => (
              <li key={item.id}>
                <article className="donation-row">
                  <div className="donation-item">
                    <p className="eyebrow">{categoryLabels[item.category]}</p>
                    <h2>{item.title}</h2>
                    <p className="donation-date">
                      Cadastrado em{' '}
                      <time dateTime={item.createdAt}>
                        {dateFormat.format(new Date(item.createdAt))}
                      </time>
                    </p>
                    <span className="donation-status" data-status={item.status}>
                      {statusLabels[item.status]}
                    </span>
                  </div>
                  <div className="donation-address">
                    <DeliveryPoint institution={item.institution} />
                    {item.status === 'PENDING_RECEIPT' && (
                      <p>Entregue o material à equipe para conferência.</p>
                    )}
                    {item.status === 'REJECTED' && item.rejectReason && (
                      <p>
                        <strong>Motivo da recusa</strong>
                        <br />
                        {item.rejectReason}
                      </p>
                    )}
                  </div>
                  {item.status === 'PENDING_RECEIPT' &&
                    (confirm === item.id ? (
                      <div
                        className="donation-confirm"
                        role="group"
                        aria-label={'Confirmar cancelamento de ' + item.title}
                      >
                        <strong>Cancelar esta doação?</strong>
                        <p>O material deixará de aguardar entrega.</p>
                        <div>
                          <button
                            ref={keep}
                            className="button"
                            disabled={busy}
                            onClick={() => {
                              setConfirm(null);
                              requestAnimationFrame(() =>
                                document
                                  .getElementById('cancel-' + item.id)
                                  ?.focus(),
                              );
                            }}
                          >
                            Manter doação
                          </button>
                          <button
                            className="button donation-danger"
                            disabled={busy}
                            onClick={() => void cancel(item.id)}
                          >
                            {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="donation-text-button donation-cancel"
                        id={'cancel-' + item.id}
                        disabled={busy}
                        onClick={() => {
                          setNotice('');
                          setConfirm(item.id);
                        }}
                      >
                        Cancelar doação
                      </button>
                    ))}
                </article>
              </li>
            ))}
          </ul>
          {list.total > list.pageSize && (
            <nav className="pager" aria-label="Páginas de doações">
              <button
                disabled={page <= 1 || busy}
                onClick={() => setPage(page - 1)}
              >
                <ArrowLeft size={16} /> Anterior
              </button>
              <span>
                Página {list.page} de {Math.ceil(list.total / list.pageSize)}
              </span>
              <button
                disabled={page * list.pageSize >= list.total || busy}
                onClick={() => setPage(page + 1)}
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
