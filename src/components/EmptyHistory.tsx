import { ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export function EmptyHistory({ kind }: { kind: 'reservation' | 'donation' }) {
  const reserving = kind === 'reservation';
  return (
    <section className="history-opening">
      <div aria-hidden="true" className="history-slip">
        <BookOpen size={36} strokeWidth={1.25} />
      </div>
      <div>
        <h2>{reserving ? 'Você ainda não fez uma reserva' : 'Você ainda não fez uma doação'}</h2>
        <p>{reserving
          ? 'Escolha um material no acervo. Depois da reserva, você encontra aqui o endereço, o prazo e o código de retirada.'
          : 'Cadastre seu primeiro material e leve-o à instituição escolhida. Aqui você acompanha a entrega e a avaliação da equipe.'}</p>
        <Link className="button primary" to={reserving ? '/catalogo' : '/doar'}>
          {reserving ? 'Explorar o acervo' : 'Doar um material'} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
