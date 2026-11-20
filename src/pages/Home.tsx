import { useEffect } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  HandHeart,
  LibraryBig,
  TicketCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  {
    icon: HandHeart,
    title: 'Doe um material',
    body: 'Cadastre seu livro ou material de estudo e leve a doação à instituição escolhida.',
  },
  {
    icon: LibraryBig,
    title: 'A instituição recebe',
    body: 'A equipe confere o material. Depois da confirmação, ele aparece no acervo para reserva.',
  },
  {
    icon: TicketCheck,
    title: 'Outro estudante retira',
    body: 'Quem reservou apresenta o código de retirada na instituição e leva o material para estudar.',
  },
];
export function Home() {
  useEffect(() => {
    document.title = 'RePassa · Conhecimento merece circular';
  }, []);
  return (
    <div className="frame">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">
            <span className="ink-rule" /> Reuso de materiais educativos
          </p>
          <h1>
            Conhecimento
            <br />
            merece <em>circular.</em>
          </h1>
          <p className="lead">
            Livros e materiais de estudo ganham uma nova história nas mãos de
            outro estudante.
          </p>
          <div className="hero-actions">
            <Link to="/catalogo" className="button primary">
              Explorar o acervo <ArrowUpRight size={19} />
            </Link>
            <Link to="/#como-funciona" className="text-action">
              Como funciona <ArrowDown size={15} />
            </Link>
          </div>
        </div>
        <figure className="hero-art">
          <img
            src="/brand/livros.webp"
            srcSet="/brand/livros-mobile.webp 760w, /brand/livros.webp 1200w"
            sizes="(max-width: 680px) 90vw, 45vw"
            width="1402"
            height="1122"
            fetchPriority="high"
            alt="Gravura de livros usados empilhados, com um livro aberto e uma samambaia."
          />
        </figure>
      </section>
      <section className="how" id="como-funciona" tabIndex={-1}>
        <div className="section-heading">
          <p className="eyebrow">
            <BookOpen size={16} /> Como funciona
          </p>
          <h2>O caminho do material</h2>
        </div>
        <ol className="steps">
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon size={24} strokeWidth={1.5} />
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
