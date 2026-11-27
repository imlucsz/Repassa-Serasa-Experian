import { useRef, useState } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import filmUrl from '../../video/repassa-promo/out/repassa-promo-audio-final.mp4?url';

export function CinematicFilm() {
  const player = useRef<HTMLVideoElement>(null);
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);

  function playFilm() {
    const video = player.current;
    if (!video) return;
    setOpened(true);
    setFailed(false);
    video.hidden = false;
    video.src = filmUrl;
    video.focus({ preventScroll: true });
    video.play().catch(() => setFailed(true));
  }

  return (
    <section className="cine-film" id="filme" aria-labelledby="film-heading" tabIndex={-1}>
      <div className="frame cine-film-inner">
        <div className="cine-film-copy">
          <p className="cine-kicker"><span className="cine-dot" /> Curta RePassa · 22 s</p>
          <h2 id="film-heading">Um livro,<br /><em>outra vida.</em></h2>
          <p>Entre a última anotação de um estudante e a primeira leitura de outro, existe uma instituição que faz a ponte. Acompanhe o percurso no filme.</p>
          <a className="cine-text-link cine-text-link-light" href="#ficha">Seguir para a ficha ↓</a>
        </div>
        <div className="cine-projection">
          <div className="cine-filmstrip" aria-hidden="true" />
          <div className="cine-screen">
            <video ref={player} hidden={!opened} controls playsInline preload="none" tabIndex={0}
              aria-label="Curta RePassa — Um livro, outra vida" onError={() => setFailed(true)}>
              {opened && <track kind="captions" src="/brand/filme-pt.vtt" srcLang="pt-BR" label="Português" default />}
            </video>
            {!opened && <button type="button" className="cine-film-play" onClick={playFilm}>
              <img src="/brand/filme-poster.webp" width="540" height="960" loading="lazy" alt="" />
              <span><Play size={15} fill="currentColor" aria-hidden="true" /> Assistir ao filme</span>
            </button>}
          </div>
          {failed && <p role="alert">O filme não pôde ser reproduzido. <a href="https://www.youtube.com/shorts/J7nbqsq0bmU">Assistir no YouTube <ArrowUpRight size={14} aria-hidden="true" /></a></p>}
        </div>
      </div>
    </section>
  );
}
