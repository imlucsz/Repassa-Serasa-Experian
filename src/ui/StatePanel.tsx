import { useEffect } from 'react';
import { ArrowLeft, BookOpen, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

type Kind =
  | 'loading'
  | 'empty'
  | 'error'
  | 'unauthorized'
  | 'forbidden'
  | 'missing'
  | 'invalid'
  | 'conflict'
  | 'limited';
const messages: Record<Kind, [string, string]> = {
  loading: ['Consultando o acervo…', 'Buscando os materiais disponíveis.'],
  empty: [
    'Nenhum material encontrado',
    'Experimente outra busca ou consulte o acervo novamente mais tarde.',
  ],
  error: [
    'Não foi possível consultar o acervo',
    'Confira sua conexão e tente novamente.',
  ],
  unauthorized: [
    'Sessão necessária',
    'Este conteúdo requer uma sessão válida. Você pode continuar pelo acervo público.',
  ],
  invalid: [
    'Consulta inválida',
    'Volte ao acervo para escolher novos filtros.',
  ],
  conflict: [
    'O material mudou de situação',
    'Consulte o acervo para ver a disponibilidade atual.',
  ],
  limited: [
    'Muitas consultas em pouco tempo',
    'Aguarde um momento antes de tentar novamente.',
  ],
  forbidden: [
    'Acesso restrito',
    'Sua conta não tem permissão para acessar este conteúdo.',
  ],
  missing: [
    'Página indisponível',
    'O endereço pode ter mudado ou o material pode ter saído de circulação.',
  ],
};
export function StatePanel({
  kind,
  retry,
  reset,
  page = false,
}: {
  kind: Kind;
  retry?: () => void;
  reset?: () => void;
  page?: boolean;
}) {
  const [title, description] = messages[kind];
  useEffect(() => {
    if (!page) return;
    const previousTitle = document.title;
    document.title = title + ' · RePassa';
    return () => { document.title = previousTitle; };
  }, [page, title]);
  const Heading = page ? 'h1' : 'h2';
  return (
    <section className="state-panel">
      <BookOpen aria-hidden="true" size={30} />
      <div role={kind === 'error' ? 'alert' : 'status'}>
        <Heading>{title}</Heading>
        <p>{description}</p>
      </div>
      {(kind === 'error' || kind === 'limited') && retry && (
        <button className="button" onClick={retry}>
          <RotateCcw size={16} /> Tentar novamente
        </button>
      )}
      {kind === 'empty' && reset && (
        <button className="button" onClick={reset}>
          Limpar filtros
        </button>
      )}
      {['unauthorized', 'forbidden', 'missing', 'invalid', 'conflict'].includes(
        kind,
      ) && (
        <Link to="/catalogo" className="button">
          <ArrowLeft size={16} /> Ir para o acervo
        </Link>
      )}
    </section>
  );
}
export function errorKind(error: unknown): Kind {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? error.status
      : null;
  if (status === 400) return 'invalid';
  if (status === 409) return 'conflict';
  if (status === 429) return 'limited';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'missing';
  return 'error';
}
