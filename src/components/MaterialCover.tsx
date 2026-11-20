import type { Material } from '../data/catalog';
import { categoryLabels } from '../data/catalog';
import './shelf.css';

// Original geometric jacket designs. A supplied material photograph takes precedence.
export function jacketVariant(material: Material) {
  const palettes = [5, 3, 4, 2, 1, 0] as const;
  const seed = parseInt(material.id.slice(-8), 16);
  return palettes[seed % palettes.length] ?? 0;
}

export function MaterialCover({ material }: { material: Material }) {
  const subject = `${material.title} ${material.description}`
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR');
  const artwork =
    material.category === 'NOTEBOOK'
      ? 'notebook'
      : material.category === 'SUPPLIES'
        ? 'tools'
        : material.category !== 'BOOK'
          ? 'pages'
          : /atlas|celest|estrela|ceu|astronom|constel/.test(subject)
            ? 'sky'
            : /mapa|cartograf|relevo|rio|bioma/.test(subject)
              ? 'map'
              : /forma|geometr|desenho|composicao/.test(subject)
                ? 'geometry'
                : 'botanical';
  return (
    <div
      className="material-jacket"
      data-jacket={jacketVariant(material)}
      data-category={material.category}
      data-artwork={artwork}
      aria-hidden="true"
    >
      <div className="jacket-print">
        <span className="jacket-category">
          {categoryLabels[material.category]}
        </span>
        <strong className="jacket-title">{material.title}</strong>
        <div className="jacket-art">
          {artwork === 'botanical' && (
            <svg viewBox="0 0 180 190" aria-hidden="true">
              <path d="M90 184C93 139 83 91 54 20M90 150C110 127 128 91 134 53M79 116C60 101 44 94 27 91M97 137c22-7 39-8 58-3" />
              <path d="M53 21C30 18 23 30 27 49c18 1 30-9 26-28ZM59 45C37 42 29 54 34 71c18 1 29-9 25-26ZM67 72C46 69 37 81 42 98c17 1 29-9 25-26Zm14 45c-20-2-28 9-24 27 17 1 29-9 24-27ZM134 53c-2-22 9-31 27-28 0 18-10 30-27 28Zm-8 27c-2-20 9-30 27-27 0 18-10 29-27 27Zm-10 27c-2-20 8-30 26-27 1 18-9 29-26 27Zm-20 27c12-17 25-19 38-7-10 16-23 19-38 7Z" />
              <circle cx="90" cy="184" r="4" />
            </svg>
          )}
          {artwork === 'sky' && (
            <svg viewBox="0 0 180 190" aria-hidden="true">
              <path d="M31 43 67 69l24-34 30 49 29-16M37 131l42-31 24 42 38-30" />
              <circle cx="31" cy="43" r="8" />
              <circle cx="67" cy="69" r="4" />
              <circle cx="91" cy="35" r="10" />
              <circle cx="121" cy="84" r="5" />
              <circle cx="150" cy="68" r="8" />
              <circle cx="37" cy="131" r="5" />
              <circle cx="79" cy="100" r="9" />
              <circle cx="103" cy="142" r="5" />
              <circle cx="141" cy="112" r="8" />
              <path d="M20 96h25m91-69h24M65 160h49" strokeDasharray="2 5" />
            </svg>
          )}
          {artwork === 'map' && (
            <svg viewBox="0 0 180 190" aria-hidden="true">
              <path d="M18 34c22-21 46-19 64 0s40 22 80-1M13 57c27-22 51-20 70 1s40 23 84-2M10 81c32-21 54-18 73 2s42 22 87-3M8 105c32-20 55-17 75 3s42 21 86-3M13 132c26-18 50-16 72 4s40 19 80-2M27 157c18-12 38-10 55 6s34 12 58-1" />
              <path d="m116 30 8 17 18 2-14 12 4 18-16-9-16 9 4-18-14-12 18-2Z" />
            </svg>
          )}
          {artwork === 'geometry' && (
            <svg viewBox="0 0 180 190" aria-hidden="true">
              <circle cx="90" cy="95" r="60" />
              <circle cx="90" cy="95" r="40" />
              <circle cx="90" cy="95" r="20" />
              <path d="M90 24v142M19 95h142M39 44l102 102M141 44 39 146M90 35 143 126H37Z" />
              <circle cx="90" cy="95" r="5" />
            </svg>
          )}
          {artwork === 'notebook' && (
            <svg viewBox="0 0 180 190" aria-hidden="true">
              <rect x="37" y="17" width="108" height="155" rx="2" />
              <path d="M55 17v155M68 46h63M68 65h63M68 84h63M68 103h63M68 122h63M68 141h63" />
              <path d="m81 30 5 5 11-12" />
            </svg>
          )}
          {artwork === 'tools' && (
            <svg viewBox="0 0 180 190" aria-hidden="true">
              <circle cx="90" cy="98" r="58" />
              <path d="M90 40v116M32 98h116M49 57l82 82M131 57l-82 82M90 98l46-36M90 98l-6-58" />
              <circle cx="90" cy="98" r="7" />
              <path d="m41 160 98-110 10 9-98 110-15 6Z" />
            </svg>
          )}
          {artwork === 'pages' && (
            <svg viewBox="0 0 180 190" aria-hidden="true">
              <path d="M28 41c28-20 96-20 124 0v108c-28-20-96-20-124 0Zm62 3v107M39 57c14-7 26-8 40-7m-40 24c14-7 26-8 40-7m-40 24c14-7 26-8 40-7m22-10c14-1 27 0 40 7m-40 17c14-1 27 0 40 7" />
              <path d="M50 30c4-12 14-18 27-18m42 18c-4-12-14-18-27-18" />
            </svg>
          )}
        </div>
        <span className="jacket-imprint">RePassa</span>
      </div>
      {material.imageUrl && (
        <img
          className="jacket-photo"
          src={material.imageUrl}
          alt=""
          draggable={false}
          decoding="async"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </div>
  );
}
