import { useEffect } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  HandHeart,
  LibraryBig,
  Sparkles,
  TicketCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthUser } from '../data/auth';
import './home.css';

const steps = [
  {
    icon: HandHeart,
    title: 'Você entrega',
    body: 'Escolha uma instituição parceira e leve até ela o material que já cumpriu seu papel com você.',
  },
  {
    icon: LibraryBig,
    title: 'A instituição confere',
    body: 'A equipe recebe o material presencialmente e o disponibiliza no acervo para outro estudante.',
  },
  {
    icon: TicketCheck,
    title: 'O conhecimento segue',
    body: 'Quem reserva retira o material no mesmo local, com um código de retirada.',
  },
];

export function Home() {
  const user = useAuthUser();

  useEffect(() => {
    document.title = 'RePassa · Conhecimento merece circular';
  }, []);

  return (
    <div className="home-page">
      <section className="home-hero frame" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <h1 id="home-title">
            Conhecimento
            <br />
            merece <em>circular.</em>
          </h1>
          <p className="home-lead">
            Um livro que termina nas suas mãos pode ser o começo de outra
            história.
          </p>
          <div className="home-actions">
            <Link to="/catalogo" className="home-button home-button-dark">
              Encontrar um material{' '}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link to="#doar" className="home-text-link">
              Quero doar <ArrowDown size={15} aria-hidden="true" />
            </Link>
          </div>
          <p className="home-promise">
            Reuso entre estudantes, com retirada em instituições parceiras.
          </p>
        </div>

        <div className="home-collage">
          <div className="home-collage-frame">
            <img
              src="/brand/livros.webp"
              srcSet="/brand/livros-mobile.webp 760w, /brand/livros.webp 1200w"
              sizes="(max-width: 680px) 92vw, (max-width: 1000px) 52vw, 48vw"
              width="1402"
              height="1122"
              fetchPriority="high"
              alt="Livros antigos empilhados, um deles aberto, acompanhados por uma samambaia e um sol coral."
            />
          </div>
          <div className="home-index-card" aria-hidden="true">
            <span className="home-index-mark">
              <Sparkles size={13} />
            </span>
            <span className="home-index-title">Caderno de leitura</span>
            <span className="home-index-line" />
            <span className="home-index-line" />
            <span className="home-index-line home-index-line-short" />
          </div>
          <div className="home-ruler" aria-hidden="true" />
          <span className="home-bookmark" aria-hidden="true">
            para a próxima leitura
          </span>
        </div>
        <a
          className="home-scroll-cue"
          href="#como-funciona"
          aria-label="Descer para conhecer o caminho do material"
        >
          <ArrowDown size={16} aria-hidden="true" />
        </a>
      </section>

      <section className="home-how" id="como-funciona" tabIndex={-1}>
        <div className="home-how-inner frame">
          <div className="home-how-heading">
            <p className="home-overline">
              <BookOpen size={15} aria-hidden="true" />
              Um ciclo simples
            </p>
            <h2>De uma estante para outra.</h2>
            <p>
              O RePassa aproxima estudantes e instituições para manter materiais
              de estudo em circulação. Cada reuso também pode evitar um descarte
              e ampliar o acesso a novos caminhos de aprendizagem.
            </p>
          </div>
          <ol className="home-steps">
            {steps.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-donate frame" id="doar" tabIndex={-1}>
        <div className="home-donate-copy">
          <p className="home-overline">
            <Sparkles size={15} aria-hidden="true" /> O próximo capítulo começa
            aqui
          </p>
          <h2>Seu material pode continuar ensinando.</h2>
          <p>
            A doação acontece em uma instituição parceira, que recebe o material
            antes de ele entrar no acervo.
          </p>
          <div className="home-actions">
            {(!user || user.role === 'STUDENT') && (
              <Link
                to={user ? '/doar' : '/cadastro?intent=doar'}
                className="home-button home-button-light"
              >
                {user ? 'Doar material' : 'Criar conta estudantil'}{' '}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            )}
            <Link
              to="/catalogo"
              className="home-text-link home-text-link-light"
            >
              Ver materiais disponíveis{' '}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export function HomeRollback() {
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);
  return <Home />;
}
