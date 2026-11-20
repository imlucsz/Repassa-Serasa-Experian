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
  return (
    <div
      className="material-jacket"
      data-jacket={jacketVariant(material)}
      data-category={material.category}
      aria-hidden="true"
    >
      <div className="jacket-print">
        <span className="jacket-category">
          {categoryLabels[material.category]}
        </span>
        <strong className="jacket-title">{material.title}</strong>
        <div className="jacket-art">
          <i />
          <i />
          <i />
          <i />
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
