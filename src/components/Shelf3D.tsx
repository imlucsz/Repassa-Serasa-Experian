import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { categoryLabels, type Material } from '../data/catalog';
import {
  calcTapeTransform,
  getActiveIndex,
  getRelativeIndex,
  getShortestLoopTarget,
  getTapeDimensions,
} from '../utils/shelfMath';
import { jacketVariant, MaterialCover } from './MaterialCover';

export function Shelf3D({ materials }: { materials: Material[] }) {
  if (!materials.length) return null;
  return (
    <CollectionShelf
      key={materials.map((material) => material.id).join(',')}
      materials={materials}
    />
  );
}

function CollectionShelf({ materials }: { materials: Material[] }) {
  const size = materials.length;
  // Duplicate short collections visually to keep the wrap seam outside the stage.
  const copies = size === 1 ? 1 : Math.max(1, Math.ceil(20 / size));
  const books = Array.from(
    { length: copies * size },
    (_, i) => materials[i % size],
  );
  const count = books.length;
  const stage = useRef<HTMLDivElement>(null);
  const elements = useRef<(HTMLDivElement | null)[]>([]);
  const location = useLocation();
  const startingIndex = Math.max(
    0,
    materials.findIndex((item) => item.id === location.state?.activeMaterial),
  );
  const target = useRef(startingIndex);
  const draw = useRef<() => void>(() => {});
  const suppressClick = useRef(false);
  const [active, setActive] = useState(startingIndex);
  // The back link passes the originating material to the next shelf.
  const navigate = useNavigate();
  const material = materials[active % size];
  const destination = '/materiais/' + material.id;
  const routeOptions = {
    state: { catalogSearch: location.search },
    viewTransition: true,
  };

  function select(position: number) {
    if (size === 1) return;
    target.current = position;
    draw.current();
  }

  useLayoutEffect(() => {
    const surface = stage.current;
    if (!surface) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let position = target.current;
    let activeBook = getActiveIndex(position, count);
    let width = 0;
    let dimensions = getTapeDimensions(0);
    let frame = 0;
    let lastTime = 0;
    let wheelTimer = 0;
    let tilt = 0;
    let drag: { x: number; start: number; id: number } | null = null;

    function paint(time: number) {
      frame = 0;
      const dt = Math.min(50, Math.max(1, time - lastTime));
      lastTime = time;
      const remaining = target.current - position;
      const settled = reduced.matches || Math.abs(remaining) < 0.001;
      position = settled
        ? target.current
        : position + remaining * (1 - Math.exp((-(drag ? 20 : 9) * dt) / 1000));
      const { H, ws, d, gap } = dimensions;
      elements.current.forEach((book, index) => {
        if (!book) return;
        const relative = getRelativeIndex(index, position, count);
        const transform = calcTapeTransform(
          relative,
          H,
          ws,
          d,
          gap,
          width,
          0,
          reduced.matches ? 0 : tilt,
          0,
        );
        book.style.visibility = transform.visible ? 'visible' : 'hidden';
        if (!transform.visible) return;
        book.style.transform = transform.transformString;
        book.style.zIndex = String(transform.zIndex);
        book.style.setProperty('--spine-shade', String(transform.spineShade));
        book.style.setProperty('--cover-shade', String(transform.coverShade));
      });
      const next = getActiveIndex(position, count);
      if (activeBook !== next) {
        activeBook = next;
        setActive(next);
      }
      if (!settled) frame = requestAnimationFrame(paint);
    }

    function schedule() {
      if (!frame) {
        lastTime = performance.now() - 16;
        frame = requestAnimationFrame(paint);
      }
    }
    draw.current = schedule;

    function resize() {
      if (!surface) return;
      width = surface.clientWidth;
      dimensions = getTapeDimensions(
        Math.min(310, surface.clientHeight * 0.75),
      );
      const { H, ws, d } = dimensions;
      surface.style.setProperty('--book-height', H + 'px');
      surface.style.setProperty('--book-width', d + 'px');
      surface.style.setProperty('--book-spine', ws + 'px');
      schedule();
    }

    function wheel(event: WheelEvent) {
      if (
        size === 1 ||
        event.ctrlKey ||
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      )
        return;
      event.preventDefault();
      const units =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
      target.current +=
        ((event.deltaX * units) / (dimensions.ws + dimensions.gap)) * 0.5;
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        target.current = Math.round(target.current);
        schedule();
      }, 140);
      schedule();
    }
    function down(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) return;
      suppressClick.current = false;
      drag = { x: event.clientX, start: target.current, id: event.pointerId };
    }
    function move(event: PointerEvent) {
      if (!surface || !event.isPrimary) return;
      if (drag && size > 1) {
        const distance = event.clientX - drag.x;
        if (!suppressClick.current && Math.abs(distance) < 6) return;
        suppressClick.current = true;
        surface.setPointerCapture(event.pointerId);
        target.current =
          drag.start - distance / (dimensions.ws + dimensions.gap);
      } else if (event.pointerType === 'mouse') {
        const bounds = surface.getBoundingClientRect();
        tilt = Math.max(
          -5,
          Math.min(
            5,
            ((event.clientX - bounds.left - width / 2) / dimensions.d) * 8,
          ),
        );
      }
      schedule();
    }
    function end(event: PointerEvent) {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      target.current = Math.round(target.current);
      schedule();
    }
    function leave() {
      tilt = 0;
      if (!suppressClick.current) drag = null;
      schedule();
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    reduced.addEventListener('change', schedule);
    surface.addEventListener('wheel', wheel, { passive: false });
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
    surface.addEventListener('pointerleave', leave);
    return () => {
      draw.current = () => {};
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(wheelTimer);
      reduced.removeEventListener('change', schedule);
      surface.removeEventListener('wheel', wheel);
      surface.removeEventListener('pointerdown', down);
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', end);
      surface.removeEventListener('pointercancel', end);
      surface.removeEventListener('pointerleave', leave);
    };
  }, [count, size]);

  return (
    <section
      className="book-shelf"
      aria-label="Estante de materiais"
      tabIndex={size > 1 ? 0 : undefined}
      aria-describedby="shelf-instructions"
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
          return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          select(
            Math.round(target.current) + (event.key === 'ArrowRight' ? 1 : -1),
          );
        }
      }}
    >
      <div className="book-stage" ref={stage} aria-hidden="true">
        <div className="book-origin">
          {books.map((item, i) => (
            <div
              key={i}
              ref={(el) => {
                elements.current[i] = el;
              }}
              className="shelf-book"
              data-jacket={jacketVariant(item)}
              onClick={() => {
                if (suppressClick.current) return;
                if (i === active) {
                  void navigate(destination, routeOptions);
                } else select(getShortestLoopTarget(target.current, i, count));
              }}
            >
              <div className={item.imageUrl ? 'book-spine has-photo' : 'book-spine'}>
                {item.imageUrl && (
                  <img
                    className="spine-photo"
                    src={item.imageUrl}
                    alt=""
                    draggable={false}
                    decoding="async"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                )}
                <div className="spine-print jacket-art">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <b>{item.title}</b>
                <span>RP</span>
              </div>
              <div
                className="book-face"
                style={{
                  viewTransitionName:
                    i === active ? 'material-cover' : undefined,
                }}
              >
                <MaterialCover material={item} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="shelf-caption">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="shelf-caption-text"
        >
          <span className="shelf-index">
            {String((active % size) + 1).padStart(2, '0')} /{' '}
            {String(size).padStart(2, '0')} ·{' '}
            {categoryLabels[material.category]}
          </span>
          <h2 key={material.id}>{material.title}</h2>
        </div>
        <div className="shelf-actions">
          <Link
            to={destination}
            {...routeOptions}
            className="shelf-detail"
            aria-label={'Ver material: ' + material.title}
          >
            Ver material <ArrowUpRight size={17} />
          </Link>
          <button
            type="button"
            disabled={size === 1}
            aria-label="Material anterior"
            onClick={() => select(Math.round(target.current) - 1)}
          >
            <ArrowLeft size={19} />
          </button>
          <button
            type="button"
            disabled={size === 1}
            aria-label="Próximo material"
            onClick={() => select(Math.round(target.current) + 1)}
          >
            <ArrowRight size={19} />
          </button>
        </div>
      </div>
      <p className="shelf-instructions" id="shelf-instructions">
        Arraste para explorar ou use as setas do teclado. A grade oferece a mesma coleção em uma lista acessível.
      </p>
    </section>
  );
}
