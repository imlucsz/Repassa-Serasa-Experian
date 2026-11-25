import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { adminMessage } from '../data/admin';

export type Read<T> = { data: T } | { error: unknown };

export function messageFor(error: unknown) {
  return adminMessage(error);
}

export function useRead<T>(load: (signal: AbortSignal) => Promise<T>) {
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

export function ReadState<T>({
  result,
  refresh,
  children,
}: {
  result: Read<T> | null;
  refresh: () => void;
  children: (data: T) => ReactNode;
}) {
  if (!result)
    return (
      <p className="inst-message" role="status">
        Carregando dados…
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

export function EmptyResults({
  children,
  clearDraft,
}: {
  children: ReactNode;
  clearDraft?: () => void;
}) {
  const [params, setParams] = useSearchParams();
  return (
    <div className="inst-message">
      <p role="status">{children}</p>
      {params.size > 0 && (
        <button
          className="button"
          type="button"
          onClick={() => {
            clearDraft?.();
            setParams({}, { replace: true });
          }}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  busy,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="admin-pager" aria-label="Paginação">
      <button
        className="button"
        type="button"
        disabled={busy || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ArrowLeft size={14} aria-hidden="true" /> Anterior
      </button>
      <p>
        Página {page} de {pages}
      </p>
      <button
        className="button"
        type="button"
        disabled={busy || page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Próxima <ArrowRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'muted';
  children: ReactNode;
}) {
  return (
    <span className="admin-pill" data-tone={tone}>
      {children}
    </span>
  );
}

export function ConfirmAction({
  label,
  prompt,
  confirmLabel = 'Confirmar',
  danger,
  busy,
  onConfirm,
  children,
}: {
  label: string;
  prompt: string;
  confirmLabel?: string;
  danger?: boolean;
  busy: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const promptId = useId();
  const promptRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  function cancel() {
    returnFocus.current = true;
    setOpen(false);
  }

  useEffect(() => {
    if (open) promptRef.current?.focus();
    else if (returnFocus.current) {
      triggerRef.current?.focus();
      returnFocus.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!busy) setOpen(false);
  }, [busy]);
  if (!open)
    return (
      <button
        type="button"
        className={'button' + (danger ? ' admin-danger' : '')}
        ref={triggerRef}
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  return (
    <div
      className="admin-confirm"
      role="group"
      aria-labelledby={promptId}
      data-danger={danger}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <p id={promptId} ref={promptRef} tabIndex={-1}>
        <strong>{prompt}</strong>
      </p>
      {children}
      <div className="admin-actions">
        <button
          type="button"
          className={'button' + (danger ? ' admin-danger' : ' primary')}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Enviando…' : confirmLabel}
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={cancel}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
