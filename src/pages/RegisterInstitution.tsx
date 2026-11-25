import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { registerInstitution } from '../data/admin';
import { useAuthUser } from '../data/auth';
import { Field } from '../ui/Field';
import { messageFor } from './adminShared';
import './admin.css';

export function RegisterInstitutionPage() {
  const user = useAuthUser();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    document.title = 'Cadastrar instituição | RePassa';
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await registerInstitution({
        name: name.trim(),
        publicAddress: address.trim(),
        pickupInstructions: instructions.trim(),
      });
      setDone(true);
    } catch (failure) {
      setError(
        failure &&
          typeof failure === 'object' &&
          'status' in failure &&
          failure.status === 409
          ? 'Já existe um cadastro com este nome e endereço aguardando análise ou aprovado.'
          : messageFor(failure),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="frame" aria-labelledby="reg-titulo">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Instituições parceiras</p>
          <h1 id="reg-titulo">Cadastrar instituição</h1>
        </div>
        <p>
          Escolas, bibliotecas e projetos podem se cadastrar como ponto de
          entrega. A administração analisa cada pedido antes da publicação.
        </p>
      </header>
      {done ? (
        <div className="inst-notice" role="status">
          <p>
            <CheckCircle2
              size={18}
              aria-hidden="true"
              style={{ verticalAlign: '-3px', marginRight: 8 }}
            />
            <strong>Cadastro enviado para análise.</strong> Assim que a equipe
            do RePassa aprovar, {name || 'a instituição'} passa a aparecer como
            ponto de entrega e os membros poderão ser vinculados.
          </p>
          <p style={{ marginTop: 12 }}>
            {user?.role === 'ADMIN' ? (
              <Link to="/admin/instituicoes?status=PENDING">
                Ver instituições pendentes
              </Link>
            ) : (
              <Link to="/catalogo">Voltar ao catálogo</Link>
            )}
          </p>
        </div>
      ) : (
        <form className="donation-form" onSubmit={submit} noValidate={false}>
          <Field id="reg-name" label="Nome da instituição">
            <input
              id="reg-name"
              required
              minLength={3}
              maxLength={120}
              value={name}
              autoComplete="organization"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field id="reg-address" label="Endereço público">
            <input
              id="reg-address"
              required
              minLength={5}
              maxLength={240}
              value={address}
              autoComplete="street-address"
              placeholder="Rua, número, bairro — cidade"
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
          <Field id="reg-instructions" label="Instruções de retirada">
            <textarea
              id="reg-instructions"
              required
              minLength={5}
              maxLength={500}
              rows={4}
              value={instructions}
              placeholder="Ex.: Balcão da secretaria, seg–sex das 9h às 17h."
              onChange={(event) => setInstructions(event.target.value)}
            />
          </Field>
          {error && (
            <p className="admin-inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-actions">
            <button className="button primary" type="submit" disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar para análise'}
            </button>
            <Link className="button" to={user?.role === 'ADMIN' ? '/admin' : '/catalogo'}>
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}
