import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, PencilLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthUser } from '../data/auth';
import { activeChapter, chapters } from './cinematicStory';
import { CinematicFilm } from './CinematicFilm';
import './cinematic-home.css';
import './cinematic-edition.css';

export function CinematicHome() {
  const user = useAuthUser();
  const [active, setActive] = useState(-1);
  const chapterRefs = useRef<(HTMLLIElement | null)[]>([]);
  const passedChapters = useRef<boolean[]>(chapters.map(() => false));
  const cardRef = useRef<HTMLDivElement>(null);
  const previousStamped = useRef(0);
  const stampedCount = active + 1;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'RePassa · Toda última página tem um recomeço';
    const existingCanonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    const canonical = existingCanonical ?? document.createElement('link');
    if (!existingCanonical) document.head.appendChild(canonical);
    const previousCanonical = canonical.getAttribute('href');
    canonical.rel = 'canonical';
    canonical.href = 'https://repassa-serasa-experian.vercel.app/';
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previousDescription = description?.content;
    description?.setAttribute(
      'content',
      'Doe materiais de estudo, encontre novos materiais e retire gratuitamente em instituições parceiras.',
    );
    return () => {
      document.title = previousTitle;
      if (!existingCanonical) canonical.remove();
      else if (previousCanonical) canonical.href = previousCanonical;
      else canonical.removeAttribute('href');
      if (description && previousDescription !== undefined)
        description.content = previousDescription ?? '';
    };
  }, []);

  useEffect(() => {
    function updateChapters() {
      const midline = window.innerHeight / 2;
      chapterRefs.current.forEach((item, index) => {
        if (item)
          passedChapters.current[index] =
            item.getBoundingClientRect().top < midline;
      });
      const next = activeChapter(passedChapters.current);
      setActive((current) => (current === next ? current : next));
    }
    updateChapters();
    window.addEventListener('scroll', updateChapters, { passive: true });
    window.addEventListener('resize', updateChapters);
    return () => {
      window.removeEventListener('scroll', updateChapters);
      window.removeEventListener('resize', updateChapters);
    };
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
      <section className="cine-hero frame" aria-labelledby="cine-title">
        <div className="cine-hero-copy">
          <p className="cine-kicker"><span className="cine-dot" /> Biblioteca de materiais de estudo</p>
          <h1 id="cine-title">
            <span className="cine-title-line cine-title-line-one">Toda última</span>{' '}
            <span className="cine-title-line cine-title-line-two">página tem</span>{' '}
            <span className="cine-title-line cine-title-line-two">um <em>recomeço.</em></span>
          </h1>
          <div className="cine-hero-intro">
            <p className="cine-lead">Doe o que já estudou. Encontre o que vem a seguir. Os materiais circulam gratuitamente pelas instituições parceiras.</p>
            <div className="cine-actions">
              <Link to="/catalogo" className="cine-button cine-button-dark">Encontrar um material <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <a href="#doar" className="cine-text-link">Quero doar <ArrowDown size={15} aria-hidden="true" /></a>
            </div>
          </div>
        </div>
        <div className="cine-art" aria-hidden="true">
          <div className="cine-volume">
            <div className="cine-jacket">
              <div className="cine-jacket-head"><span>RePassa</span><i>Acervo estudantil</i></div>
              <div className="cine-cover-title">O próximo<br /><i>leitor.</i></div>
              <img src="/brand/livros.webp" srcSet="/brand/livros-mobile.webp 760w, /brand/livros.webp 1200w"
                sizes="(max-width: 760px) 69vw, 34vw" width="1402" height="1122" fetchPriority="high" alt="" />
            </div>
            <div className="cine-bookmark" />
          </div>
          <div className="cine-slip"><small>Ficha de circulação</small><i>Para quem vem depois.</i></div>
        </div>
        <nav className="cine-contents" aria-label="Nesta edição">
          <span>Nesta edição</span>
          <a href="#filme">O filme <ArrowDown size={14} aria-hidden="true" /></a>
          <a href="#ficha">A ficha de circulação <ArrowDown size={14} aria-hidden="true" /></a>
        </nav>
      </section>
      <CinematicFilm />

      <section className="cine-story" id="como-funciona" tabIndex={-1}>
        <div className="frame" id="ficha" tabIndex={-1}>
          <div className="cine-story-intro">
            <h2>A ficha de circulação.</h2>
            <p>
              Da entrega à retirada, acompanhe as quatro etapas que levam um material até outro estudante.
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
                <span className="cine-card-title">Registro do material</span>
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
                  <span className="cine-kicker">{chapter.stage}</span>
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

      <section className="cine-close" id="repassar" tabIndex={-1}>
        <div className="frame cine-close-inner" id="doar" tabIndex={-1}>
          <div className="cine-close-copy">
            <span className="cine-close-rule" aria-hidden="true" />
            <h2>O conhecimento não termina em quem aprende. <em>Ele continua quando alguém repassa.</em></h2>
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
