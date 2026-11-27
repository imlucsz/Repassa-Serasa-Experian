import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, PencilLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthUser } from '../data/auth';
import { activeChapter, chapters } from './cinematicStory';
import './cinematic-home.css';

export function CinematicHome() {
  const user = useAuthUser();
  const [active, setActive] = useState(-1);
  const chapterRefs = useRef<(HTMLLIElement | null)[]>([]);
  const passedChapters = useRef<boolean[]>(chapters.map(() => false));
  const cardRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLElement>(null);
  const previousStamped = useRef(0);
  const stampedCount = active + 1;

  useEffect(() => {
    document.title = 'RePassa · O conhecimento continua (prévia)';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => {
      robots.remove();
    };
  }, []);

  useEffect(() => {
    const items = chapterRefs.current.filter(
      (item): item is HTMLLIElement => item !== null,
    );
    if (!('IntersectionObserver' in window)) {
      setActive(chapters.length - 1);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const midline = entries[0]?.rootBounds?.top ?? window.innerHeight / 2;
        chapterRefs.current.forEach((item, index) => {
          if (item)
            passedChapters.current[index] =
              item.getBoundingClientRect().top < midline;
        });
        const next = activeChapter(passedChapters.current);
        setActive((current) => (current === next ? current : next));
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    for (const item of items) observer.observe(item);
    if (heroRef.current) observer.observe(heroRef.current);
    if (closeRef.current) observer.observe(closeRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      stampedCount > previousStamped.current &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      cardRef.current?.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(1.5px)' },
          { transform: 'translateY(0)' },
        ],
        { duration: 160, delay: 170, easing: 'ease-out' },
      );
    }
    previousStamped.current = stampedCount;
  }, [stampedCount]);

  return (
    <div className="cine-page">
      <section
      className="cine-hero frame"
      aria-labelledby="cine-title"
      ref={heroRef}
    >
        <div className="cine-hero-copy">
          <h1 id="cine-title">
            <span className="cine-title-line cine-title-line-one">
              O conhecimento não termina em quem aprende.
            </span>
            <span className="cine-title-line cine-title-line-two">
              Ele continua quando alguém{' '}
              <em className="cine-repassa">
                repassa
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 14"
                  preserveAspectRatio="none"
                  focusable="false"
                >
                  <path d="M 2 10 C 30 12, 63 4, 98 6" />
                </svg>
              </em>
              .
            </span>
          </h1>
          <div className="cine-hero-intro">
            <p className="cine-lead">
              Livros, apostilas e materiais de estudo que já cumpriram o seu
              papel seguem para outro estudante, sempre por meio de uma
              instituição parceira.
            </p>
            <div className="cine-actions">
              <Link to="/catalogo" className="cine-button cine-button-dark">
                Encontrar um material{' '}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link to="#repassar" className="cine-text-link">
                Quero doar <ArrowDown size={15} aria-hidden="true" />
              </Link>
            </div>
            <Link to="#ficha" className="cine-text-link cine-story-link">
              Siga a ficha <ArrowDown size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="cine-art">
          <div className="cine-art-frame">
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
          <div className="cine-peek-motion" aria-hidden="true">
            <div className="cine-peek-card">
              <span>Ficha de empréstimo</span>
              <div className="cine-peek-slots">
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cine-story" id="ficha" tabIndex={-1}>
        <div className="frame">
          <div className="cine-story-intro">
            <h2>Uma ficha, quatro carimbos, nenhum atalho.</h2>
            <p>
              Todo material registra o próprio caminho. Ele nunca vai direto de
              uma pessoa para outra: passa antes por uma instituição que confere
              e guarda.
            </p>
          </div>
          <div className="cine-story-columns">
            <div
              className="cine-card"
              ref={cardRef}
              data-stamped={stampedCount}
              aria-hidden="true"
            >
              <div className="cine-card-head">
                <span className="cine-card-brand">RePassa</span>
                <span className="cine-card-title">Ficha de empréstimo</span>
                <span className="cine-card-subtitle">
                  Material de estudo · em circulação
                </span>
              </div>
              <div className="cine-card-body">
                {chapters.map((chapter, index) => (
                  <div
                    className="cine-card-row"
                    data-active={index === active ? 'true' : 'false'}
                    key={chapter.stage}
                  >
                    <span className="cine-card-stage">{chapter.stage}</span>
                    <span
                      className="cine-stamp-slot"
                      data-stamped={index < stampedCount ? 'true' : 'false'}
                    >
                      <span
                        className="cine-stamp"
                        data-ink={chapter.ink}
                        data-stamped={index < stampedCount ? 'true' : 'false'}
                        style={
                          { '--r': chapter.rotate + 'deg' } as CSSProperties
                        }
                      >
                        {chapter.stamp}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <ol className="cine-chapters">
              {chapters.map((chapter, index) => (
                <li
                  data-active={index === active ? 'true' : 'false'}
                  data-chapter-index={index}
                  key={chapter.stage}
                  ref={(element) => {
                    chapterRefs.current[index] = element;
                  }}
                >
                  <h3>{chapter.title}</h3>
                  <p>{chapter.body}</p>
                  <span className="cine-note">
                    <PencilLine size={14} aria-hidden="true" />
                    {chapter.note}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="cine-close" id="repassar" tabIndex={-1} ref={closeRef}>
        <div className="frame cine-close-inner">
          <div className="cine-close-copy">
            <span className="cine-close-rule" aria-hidden="true" />
            <h2>A sua última página pode ser a primeira de alguém.</h2>
          </div>
          <div className="cine-close-side">
            <p>
              A doação acontece em uma instituição parceira, que recebe o
              material antes de ele entrar no acervo.
            </p>
            <div className="cine-actions">
              {(!user || user.role === 'STUDENT') && (
                <Link
                  to={user ? '/doar' : '/cadastro?intent=doar'}
                  className="cine-button cine-button-light"
                >
                  {user ? 'Doar material' : 'Criar conta estudantil'}{' '}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              )}
              <Link
                to="/catalogo"
                className="cine-text-link cine-text-link-light"
              >
                Ver materiais disponíveis{' '}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
