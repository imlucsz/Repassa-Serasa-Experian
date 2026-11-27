import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Play } from 'lucide-react';
import filmUrl from '../../video/repassa-promo/out/repassa-promo-audio-final.mp4?url';

type FilmState = 'poster' | 'loading' | 'ready' | 'failed';

export function CinematicFilm() {
  const player = useRef<HTMLVideoElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [state, setState] = useState<FilmState>('poster');
  const showingPoster = state === 'poster' || state === 'failed';

  function showFailure() {
    restoreFocus.current ||= document.activeElement === player.current;
    setState('failed');
  }

  useEffect(() => {
    if (state === 'failed' && restoreFocus.current) {
      retry.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [state]);

  function playFilm() {
    const video = player.current;
    if (!video) return;
    setState('loading');
    video.hidden = false;
    video.poster = '/brand/filme-poster.webp';
    video.src = filmUrl;
    video.focus({ preventScroll: true });
    video.play().catch(showFailure);
  }

  return (
    <section className="cine-film" id="filme" aria-labelledby="film-heading" tabIndex={-1}>
      <div className="frame cine-film-inner">
        <div className="cine-film-copy">
          <p className="cine-kicker"><span className="cine-dot" /> Curta RePassa · 22 s</p>
          <h2 id="film-heading">Um livro,<br /><em>outra vida.</em></h2>
          <p>Entre a última anotação de um estudante e a primeira leitura de outro, existe uma instituição que faz a ponte. Acompanhe o percurso no filme.</p>
          <a className="cine-text-link cine-text-link-light" href="#ficha">
            Seguir para a ficha <ArrowDown size={15} aria-hidden="true" />
          </a>
        </div>
        <div className="cine-projection">
          <div className="cine-filmstrip" aria-hidden="true" />
          <div className="cine-screen">
            <video
              ref={player}
              hidden={showingPoster}
              controls
              playsInline
              preload="none"
              tabIndex={0}
              aria-label="Curta RePassa — Um livro, outra vida"
              onPlaying={() => setState('ready')}
              onError={showFailure}
            >
              {!showingPoster && <track kind="captions" src="/brand/filme-pt.vtt" srcLang="pt-BR" label="Português" default />}
            </video>
            {showingPoster && (
              <button ref={retry} type="button" className="cine-film-play" onClick={playFilm}>
                <img src="/brand/filme-poster.webp" width="540" height="960" loading="lazy" alt="" />
                <span>
                  <Play size={15} fill="currentColor" aria-hidden="true" />
                  {state === 'failed' ? 'Tentar novamente' : 'Assistir ao filme'}
                </span>
              </button>
            )}
            <span role="status" className="cine-film-status">
              {state === 'loading' && 'Carregando o filme…'}
            </span>
          </div>
          {state === 'failed' && (
            <p role="alert">
              O filme não pôde ser reproduzido.{' '}
              <a href="https://www.youtube.com/shorts/J7nbqsq0bmU">
                Assistir no YouTube <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
