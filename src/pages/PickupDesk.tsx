import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  confirmPickup,
  OperationError,
  pickupCodeFormat,
} from '../data/operations';
import type { Institution } from '../data/contract';
import { Field } from '../ui/Field';

const localDateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

type Outcome =
  | { kind: 'confirmed'; completedAt: string }
  | { kind: 'uncertain' }
  | { kind: 'denied' }
  | { kind: 'session' };

export function PickupDesk({ institution }: { institution: Institution }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalidCode, setInvalidCode] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const flight = useRef<AbortController | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLHeadingElement>(null);
  const search = '?instituicao=' + encodeURIComponent(institution.id);

  useEffect(() => () => flight.current?.abort(), []);
  useEffect(() => {
    if (outcome) result.current?.focus();
  }, [outcome]);

  function rejectCode(message: string) {
    setError(message);
    setInvalidCode(true);
    codeInput.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || outcome) return;
    const code = codeInput.current?.value.trim() ?? '';
    if (!pickupCodeFormat.test(code)) {
      rejectCode(
        'Confira os 12 caracteres do código. Os hifens são opcionais.',
      );
      return;
    }
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setError('');
    setInvalidCode(false);
    try {
      const receipt = await confirmPickup(
        institution.id,
        code,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setOutcome({ kind: 'confirmed', completedAt: receipt.completedAt });
    } catch (failure) {
      if (controller.signal.aborted) return;
      const status = failure instanceof OperationError ? failure.status : 0;
      switch (status) {
        case 400:
        case 404:
        case 409:
          rejectCode(
            'Código inválido, vencido ou já utilizado. Confira o código e o prazo com o estudante.',
          );
          break;
        case 401:
          setOutcome({ kind: 'session' });
          break;
        case 403:
          setOutcome({ kind: 'denied' });
          break;
        case 429:
          setError(
            'Muitas tentativas. Aguarde um momento antes de tentar novamente.',
          );
          break;
        default:
          setOutcome({ kind: 'uncertain' });
      }
    } finally {
      flight.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function restart() {
    setOutcome(null);
    requestAnimationFrame(() => codeInput.current?.focus());
  }

  if (outcome) {
    const confirmed = outcome.kind === 'confirmed';
    const heading = {
      confirmed: 'Retirada confirmada',
      uncertain: 'Confirmação pendente de verificação',
      denied: 'Acesso à instituição indisponível',
      session: 'Sua sessão expirou',
    }[outcome.kind];
    return (
      <div className="inst-pickup inst-result">
        <h2 className="inst-subtitle" tabIndex={-1} ref={result}>
          {heading}
        </h2>
        {confirmed ? (
          <p role="status">
            Entrega registrada em{' '}
            <time dateTime={outcome.completedAt}>
              {localDateTime.format(new Date(outcome.completedAt))}
            </time>{' '}
            (horário de São Paulo). O código foi utilizado.
          </p>
        ) : outcome.kind === 'uncertain' ? (
          <p role="alert">
            A resposta do serviço não chegou completa. Confira a situação do
            material no estoque antes de entregá-lo ou iniciar outra retirada.
          </p>
        ) : outcome.kind === 'denied' ? (
          <p role="alert">
            Verifique seu vínculo com a instituição antes de continuar.
          </p>
        ) : (
          <p role="alert">
            Entre novamente para verificar a situação do material.
          </p>
        )}
        <div className="inst-actions">
          {confirmed && (
            <button type="button" className="button primary" onClick={restart}>
              Registrar outra retirada{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          {(confirmed || outcome.kind === 'uncertain') && (
            <Link className="button" to={'/instituicao/estoque' + search}>
              Consultar estoque
            </Link>
          )}
          {outcome.kind === 'denied' && (
            <Link className="button" to="/instituicao">
              Voltar ao painel
            </Link>
          )}
          {outcome.kind === 'session' && (
            <Link
              className="button"
              to={
                '/entrar?returnTo=' +
                encodeURIComponent('/instituicao/retirada' + search)
              }
            >
              Entrar novamente
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form className="inst-pickup" onSubmit={submit}>
      <h2 className="inst-subtitle">Entrega do material</h2>
      <p className="inst-description">
        Peça ao estudante que apresente o código de retirada da reserva.
      </p>
      <Field id="pickup-code" label="Código de retirada">
        <input
          id="pickup-code"
          ref={codeInput}
          className="inst-code"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="XXXX-XXXX-XXXX"
          spellCheck={false}
          readOnly={busy}
          required
          maxLength={14}
          aria-describedby={
            invalidCode ? 'pickup-format pickup-error' : 'pickup-format'
          }
          aria-invalid={invalidCode || undefined}
          onChange={() => {
            setInvalidCode(false);
            setError('');
          }}
        />
      </Field>
      <p className="inst-hint" id="pickup-format">
        12 letras e números, com ou sem hifens.
      </p>
      <label className="inst-check">
        <input type="checkbox" required disabled={busy} />
        Conferi o material e o estudante está presente para retirá-lo.
      </label>
      {error && (
        <p id="pickup-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        <Check size={16} aria-hidden="true" />
        {busy ? 'Confirmando…' : 'Confirmar retirada'}
      </button>
    </form>
  );
}
